#!/usr/bin/env bun

/**
 * ============================================================================
 * NOTION SYNC CLI - Sync Notion Board Pages to Local Markdown Files
 * ============================================================================
 *
 * A CLI tool to synchronize Notion board pages (Epics, Stories, Bugs, Defects,
 * Improvements, Tech Stories, Tech Debts) to local Markdown files in
 * `.context/PBI/`. This is the Modality-notion counterpart of
 * `scripts/sync-jira-issues.ts` — the tracker is the source of truth; local
 * `.md` files are a read-only cache.
 *
 * NOTION API DOCUMENTATION:
 *   - REST API:   https://developers.notion.com/reference
 *   - Database query: POST /v1/databases/{id}/query
 *   - Database schema: GET /v1/databases/{id}
 *   - Pages: GET /v1/pages/{id}
 *   - Blocks: GET /v1/blocks/{id}/children
 *   - Comments: GET /v1/comments?block_id={id}
 *   - Users: GET /v1/users/{id}
 *   - Authentication: `Authorization: Bearer <NOTION_TOKEN>` +
 *     `Notion-Version: 2022-06-28`
 *
 * ============================================================================
 * REQUIREMENTS
 * ============================================================================
 *
 * 1. Bun runtime (https://bun.sh)
 * 2. A Notion API token (Internal Integration) — create one at
 *    https://www.notion.so/my-integrations and SHARE the board with it.
 * 3. No external dependencies - uses native fetch API
 *
 * ============================================================================
 * ENVIRONMENT SETUP
 * ============================================================================
 *
 * Required environment variables:
 *   NOTION_TOKEN=secret_XXXX...
 *   NOTION_DATABASE_ID=8a3f0c1e...   (database that holds the board pages)
 *
 * Optional:
 *   NOTION_DATABASE_BUGS_ID=...      # second DB whose pages are all Bugs/Defects
 *   NOTION_SYNC_OUTPUT=.context/PBI  # output directory
 *
 * Property names are resolved LIVE from the database schema using
 * `.agents/notion-required.yaml` (database: block = role → property name,
 * required/optional = content fields). No field catalog is synced — if a
 * property is missing from the schema the sync emits an actionable stub.
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 * Run with Bun:
 *   bun run notion:sync-issues <command> [options]
 *
 * COMMANDS:
 *   status              Check configuration, connection and schema vs manifest
 *   pull                Sync Epics, Stories & Bugs (default scope)
 *     stories           Sync only Stories (and their parents/defects)
 *     bugs              Sync only Bugs
 *     defects           Sync all Defects (standalone included)
 *     improvements      Sync only Improvements
 *     --epic <KEY>      Sync one epic with all its stories
 *     --story <KEY>     Sync one story only
 *     --include-comments Include page comments in comments.md
 *     --dry-run         Show what would be done without writing files
 *     --json            Output results as JSON
 *     --sprint <name>   Only pages whose Sprint property equals <name>
 *     --types <csv>     Extra work types to sync (story,epic,bug,defect,...)
 *     --no-defects      Skip defect discovery entirely
 *     --database <id>   Override NOTION_DATABASE_ID
 *   get <KEY>           Sync ONE page (full id, short id or title slug) with ALL
 *                       fields + comments (canonical read; replaces MCP query)
 *   query "Prop=Value"  Sync every page matching a single-property filter
 *   help                Show this help message
 *
 * EXAMPLES:
 *   bun run notion:sync-issues status
 *   bun run notion:sync-issues pull
 *   bun run notion:sync-issues pull --sprint "Sprint 12" --include-comments
 *   bun run notion:sync-issues pull --types improvements
 *   bun run notion:sync-issues get 1a2b3c4d
 *   bun run notion:sync-issues query "Status=Done"
 *
 * ============================================================================
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const DEFAULT_OUTPUT_DIR = '.context/PBI';
const NOTION_REQUIRED_PATH = join(import.meta.dir, '..', '.agents', 'notion-required.yaml');
const SYNC_FOOTER = '_Synced from Notion by sync-notion-issues_';

/** Folder-name prefixes per registry slug (mirror of FOLDER_PREFIX in sync-jira-issues.ts). */
const FOLDER_PREFIX: Record<string, string> = {
  story: 'STORY',
  bug: 'BUG',
  epic: 'EPIC',
  defect: 'DEFECT',
  improvement: 'IMPROVEMENT',
  tech_story: 'TECHSTORY',
  tech_debt: 'TECHDEBT',
};

/** Local output directory per registry slug (fallback when the registry lacks `local_dir`). */
const DEFAULT_DIRS: Record<string, string> = {
  epic: 'epics',
  story: 'epics/_orphans', // stories render under their epic; orphans go to _orphans
  bug: 'bugs',
  defect: 'defects',
  improvement: 'improvements',
  tech_story: 'tech-stories',
  tech_debt: 'tech-debts',
};

/** Block types whose children are fetched recursively and rendered nested. */
const CHILD_BLOCK_TYPES = new Set([
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'quote',
  'callout',
  'table',
  'column_list',
  'column',
  'synced_block',
  'template',
]);

// ============================================================================
// TYPES
// ============================================================================

interface Config {
  token: string
  databaseId: string
  bugsDatabaseId: string | null
  outputDir: string
}

interface FieldSpec {
  name: string
  type: string
  fallback?: { target: string, label: string }
  options?: string[]
  description?: string
}

interface WorkType {
  notion_item_type: string
  description?: string
  sync?: string
  coverable?: boolean
  container?: boolean
  content?: string
  local_dir?: string
  recommended?: boolean
}

interface Manifest {
  database: Record<string, string>
  required: Record<string, FieldSpec>
  optional: Record<string, FieldSpec>
  unmapped: Record<string, FieldSpec>
  work_types: Record<string, WorkType>
}

interface RegistryEntry extends WorkType {
  slug: string
}

interface RichTextSegment {
  type?: string
  plain_text: string
  href?: string | null
  annotations?: {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
    color?: string
  }
}

interface MediaContent {
  url?: string
  name?: string
}

interface BlockContent {
  rich_text?: RichTextSegment[]
  caption?: RichTextSegment[]
  language?: string
  checked?: boolean
  title?: string
  url?: string
  expression?: string
  icon?: { emoji?: string } | null
  image?: MediaContent
  video?: MediaContent
  file?: MediaContent
  pdf?: MediaContent
  audio?: MediaContent
}

interface NotionBlock {
  id: string
  type: string
  has_children?: boolean
  children?: NotionBlock[]
  [key: string]: unknown
}

interface PropertyDef {
  id: string
  type: string
  relation?: { database_id?: string, type?: string, single_property?: string | null, dual_property?: string | null }
  select?: { options?: Array<{ id?: string, name: string }> }
  status?: { options?: Array<{ id?: string, name: string }> }
}

interface DatabaseSchema {
  id: string
  title?: Array<{ plain_text: string }>
  properties: Record<string, PropertyDef>
}

interface NotionPropValue {
  type: string
  id?: string
  title?: RichTextSegment[]
  rich_text?: RichTextSegment[]
  select?: { name: string } | null
  status?: { name: string } | null
  multi_select?: Array<{ name: string }>
  people?: Array<{ id: string }>
  url?: string | null
  number?: number | null
  relation?: Array<{ id: string }>
  files?: Array<{ name: string }>
  checkbox?: boolean
  date?: { start?: string | null, end?: string | null }
  formula?: { type: string, string?: string | null, number?: number | null }
  rollup?: { type: string, number?: number | null, string?: string | null }
  unique_id?: { prefix?: string | null, number?: number | null }
  created_time?: string
  last_edited_time?: string
  created_by?: { id: string }
  last_edited_by?: { id: string }
}

interface NotionPage {
  id: string
  title: string
  properties: Record<string, NotionPropValue>
  created_time: string
  last_edited_time: string
  url?: string
}

interface NotionComment {
  id: string
  rich_text: RichTextSegment[]
  created_time: string
  created_by?: { id: string }
}

interface FieldFileSpec {
  slug: string
  file: string
  title: string
}

interface PlannedFieldFile {
  spec: FieldFileSpec
  content: string | null
  stub: boolean
}

interface PageData {
  id: string // full Notion page id (source of truth for relations)
  page: NotionPage
  schema: DatabaseSchema
  slug: string // registry slug: story | bug | epic | ...
  key: string // short 8-hex page id (stable across renames)
  folderName: string // PREFIX-<key>-<slug>
  title: string
  parentId: string | null
  relatedDefectIds: string[]
  bodyMd: string
  commentsMd: string | null
}

interface SyncOptions {
  epicKey?: string
  storyKey?: string
  subcommand?: string
  includeComments: boolean
  dryRun: boolean
  json: boolean
  sprint?: string
  types: string[]
  noDefects: boolean
}

interface SyncResult {
  success: boolean
  synced: number
  files: { created: number, updated: number, skipped: number }
  types: Record<string, number>
  warnings: string[]
  duration_ms: number
}

interface ParsedArgs {
  command: string
  subcommand?: string
  getKey?: string
  query?: string
  epic?: string
  story?: string
  includeComments: boolean
  dryRun: boolean
  json: boolean
  sprint?: string
  types?: string[]
  noDefects?: boolean
  database?: string
}

// ============================================================================
// COLORS & OUTPUT HELPERS
// ============================================================================

const colors = {
  reset: '\x1B[0m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  red: '\x1B[31m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  cyan: '\x1B[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✔${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.error(`${colors.red}✖${colors.reset} ${msg}`),
  title: (msg: string) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`),
  line: (msg: string) => console.log(msg),
  dim: (msg: string) => console.log(`${colors.dim}${msg}${colors.reset}`),
  json: (obj: unknown) => console.log(JSON.stringify(obj, null, 2)),
};

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

const PULL_SUBCOMMANDS = new Set(['stories', 'bugs', 'defects', 'improvements']);

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: args[0] || 'help',
    includeComments: false,
    dryRun: false,
    json: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (PULL_SUBCOMMANDS.has(arg)) {
      result.subcommand = arg;
      continue;
    }

    switch (arg) {
      case '--epic':
        result.epic = nextArg;
        i++;
        break;
      case '--story':
        result.story = nextArg;
        i++;
        break;
      case '--include-comments':
        result.includeComments = true;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--json':
        result.json = true;
        break;
      case '--sprint':
        result.sprint = nextArg;
        i++;
        break;
      case '--types':
        result.types = (nextArg ?? '').split(',').map(s => s.trim()).filter(Boolean);
        i++;
        break;
      case '--no-defects':
        result.noDefects = true;
        break;
      case '--database':
        result.database = nextArg;
        i++;
        break;
      default:
        if (!result.command || arg !== result.command) {
          // First positional is the command; second positional (get/query) is the value.
          if (!result.getKey && !result.query) {
            if (result.command === 'get') { result.getKey = arg; }
            else if (result.command === 'query') { result.query = arg; }
          }
        }
        break;
    }
  }

  return result;
}

// ============================================================================
// CONFIG & MANIFEST
// ============================================================================

function getConfig(): Config {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!token) {
    throw new Error('Missing required environment variable: NOTION_TOKEN (create an Internal Integration token at https://www.notion.so/my-integrations)');
  }
  if (!databaseId) {
    throw new Error('Missing required environment variable: NOTION_DATABASE_ID (share the board with your integration; the id is the 32-hex UUID from the database URL)');
  }
  const outputDir = process.env.NOTION_SYNC_OUTPUT || DEFAULT_OUTPUT_DIR;
  return {
    token,
    databaseId,
    bugsDatabaseId: process.env.NOTION_DATABASE_BUGS_ID || null,
    outputDir,
  };
}

function loadManifest(): Manifest {
  if (!existsSync(NOTION_REQUIRED_PATH)) {
    throw new Error(`Missing manifest: ${NOTION_REQUIRED_PATH}. Run \`bun run agents:setup\` or create .agents/notion-required.yaml`);
  }
  const raw = readFileSync(NOTION_REQUIRED_PATH, 'utf-8');
  return parseYaml(raw) as Manifest;
}

function buildRegistry(manifest: Manifest): Map<string, RegistryEntry> {
  const registry = new Map<string, RegistryEntry>();
  for (const [slug, entry] of Object.entries(manifest.work_types)) {
    const e: RegistryEntry = { ...entry, slug };
    registry.set(e.notion_item_type, e);
    registry.set(slug, e);
  }
  return registry;
}

function fieldByName(manifest: Manifest, slug: string): FieldSpec | undefined {
  return manifest.required[slug] ?? manifest.optional[slug];
}

function allFields(manifest: Manifest): FieldSpec[] {
  return [...Object.values(manifest.required), ...Object.values(manifest.optional)];
}

function notionTypeName(manifest: Manifest, slug: string): string {
  return manifest.work_types[slug]?.notion_item_type ?? slug;
}

function localDirFor(registry: Map<string, RegistryEntry>, slug: string): string {
  return registry.get(slug)?.local_dir ?? DEFAULT_DIRS[slug] ?? slug;
}

function resolvePropertyName(manifest: Manifest, schema: DatabaseSchema, prop: string): string | null {
  if (schema.properties[prop]) { return prop; }
  for (const field of allFields(manifest)) {
    if (field.name === prop) { return field.name; }
  }
  return null;
}

// ============================================================================
// NOTION API LAYER
// ============================================================================

async function notionFetch(config: Config, path: string, init: RequestInit = {}): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.token}`,
    'Notion-Version': NOTION_VERSION,
  };
  if (init.body) { headers['Content-Type'] = 'application/json'; }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  }
  catch (err) {
    throw new Error(`Network error calling ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json() as { code?: string, message?: string };
      detail = data.message ? ` (${data.code ?? 'error'}: ${data.message})` : '';
    }
    catch {
      // non-JSON error body — ignore
    }
    throw new Error(`Notion API ${response.status} on ${path}${detail}`);
  }

  return response.json() as Promise<unknown>;
}

function toApiId(id: string): string {
  const clean = id.replace(/-/g, '');
  if (/^[0-9a-f]{32}$/i.test(clean)) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  return id;
}

function shortKey(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

async function fetchDatabase(config: Config, dbId: string): Promise<DatabaseSchema> {
  return await notionFetch(config, `/databases/${toApiId(dbId)}`) as DatabaseSchema;
}

async function queryDatabasePages(config: Config, dbId: string, filter?: unknown): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) { body.start_cursor = cursor; }
    if (filter) { body.filter = filter; }
    const res = await notionFetch(config, `/databases/${toApiId(dbId)}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    }) as { results?: NotionPage[], has_more?: boolean, next_cursor?: string | null };
    pages.push(...(res.results ?? []));
    cursor = res.has_more ? (res.next_cursor ?? null) : null;
  } while (cursor);
  return pages;
}

async function fetchBlockChildren(config: Config, blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | null = null;
  do {
    const query = cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : '';
    const res = await notionFetch(config, `/blocks/${toApiId(blockId)}/children?page_size=100${query}`) as {
      results?: NotionBlock[]
      has_more?: boolean
      next_cursor?: string | null
    };
    blocks.push(...(res.results ?? []));
    cursor = res.has_more ? (res.next_cursor ?? null) : null;
  } while (cursor);
  return blocks;
}

async function fetchComments(config: Config, pageId: string): Promise<NotionComment[]> {
  const comments: NotionComment[] = [];
  let cursor: string | null = null;
  do {
    const query = cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : '';
    const res = await notionFetch(config, `/comments?block_id=${encodeURIComponent(toApiId(pageId))}&page_size=100${query}`) as {
      results?: NotionComment[]
      has_more?: boolean
      next_cursor?: string | null
    };
    comments.push(...(res.results ?? []));
    cursor = res.has_more ? (res.next_cursor ?? null) : null;
  } while (cursor);
  return comments;
}

const userCache = new Map<string, string>();

async function resolveUserName(config: Config, userId: string): Promise<string> {
  if (!userId || userId === 'unknown') { return 'Unknown'; }
  const cached = userCache.get(userId);
  if (cached) { return cached; }
  try {
    const user = await notionFetch(config, `/users/${toApiId(userId)}`) as { name?: string };
    const name = user.name || 'Unknown';
    userCache.set(userId, name);
    return name;
  }
  catch {
    userCache.set(userId, 'Unknown');
    return 'Unknown';
  }
}

// ============================================================================
// PROPERTY READERS
// ============================================================================

function getText(page: NotionPage, name: string): string {
  const val = page.properties[name];
  if (!val) { return ''; }
  if (val.type === 'title' || val.type === 'rich_text') {
    return (val.title ?? val.rich_text ?? []).map(s => s.plain_text).join('');
  }
  return '';
}

function getSingleOptionName(page: NotionPage, name: string): string | null {
  const val = page.properties[name];
  if (!val) { return null; }
  if (val.type === 'select' || val.type === 'status') {
    return val.select?.name ?? val.status?.name ?? null;
  }
  if (val.type === 'multi_select') { return val.multi_select?.[0]?.name ?? null; }
  if (val.type === 'title' || val.type === 'rich_text') { return getText(page, name) || null; }
  return null;
}

function getMultiSelectNames(page: NotionPage, name: string): string[] {
  const val = page.properties[name];
  if (!val || val.type !== 'multi_select') { return []; }
  return (val.multi_select ?? []).map(o => o.name);
}

function getUrl(page: NotionPage, name: string): string | null {
  const val = page.properties[name];
  if (!val || val.type !== 'url') { return null; }
  return val.url ?? null;
}

function getNumber(page: NotionPage, name: string): number | null {
  const val = page.properties[name];
  if (!val || val.type !== 'number') { return null; }
  return val.number ?? null;
}

function getRelationIds(page: NotionPage, name: string): string[] {
  const val = page.properties[name];
  if (!val || val.type !== 'relation') { return []; }
  return (val.relation ?? []).map(r => r.id);
}

async function getPeopleNames(config: Config, page: NotionPage, name: string): Promise<string[]> {
  const val = page.properties[name];
  const ids = (val && val.type === 'people' ? (val.people ?? []) : []).map(p => p.id);
  const names: string[] = [];
  for (const id of ids) {
    names.push(await resolveUserName(config, id));
  }
  return names;
}

// ============================================================================
// BLOCKS → MARKDOWN
// ============================================================================

function richTextToMarkdown(segments: RichTextSegment[] | undefined): string {
  return (segments ?? [])
    .map((seg) => {
      let text = seg.plain_text;
      const a = seg.annotations ?? {};
      if (a.code) { text = `\`${text}\``; }
      if (a.bold) { text = `**${text}**`; }
      if (a.italic) { text = `_${text}_`; }
      if (a.strikethrough) { text = `~~${text}~~`; }
      if (seg.href) { text = `[${text}](${seg.href})`; }
      return text;
    })
    .join('');
}

function mediaUrl(content: BlockContent): { url: string, name: string } {
  const media = content.image ?? content.video ?? content.file ?? content.pdf ?? content.audio;
  const url = media?.url ?? '';
  const name = media?.name ?? '';
  return { url, name };
}

function renderBlocks(blocks: NotionBlock[], level = 0): string[] {
  const out: string[] = [];
  const pad = '  '.repeat(Math.max(level - 1, 0));

  for (const block of blocks) {
    const type = block.type;
    const payload = (block[type] ?? {}) as BlockContent;

    switch (type) {
      case 'paragraph': {
        const t = richTextToMarkdown(payload.rich_text);
        if (t) { out.push(`${pad}${t}`); }
        break;
      }
      case 'heading_1':
        out.push(`${pad}# ${richTextToMarkdown(payload.rich_text)}`);
        break;
      case 'heading_2':
        out.push(`${pad}## ${richTextToMarkdown(payload.rich_text)}`);
        break;
      case 'heading_3':
        out.push(`${pad}### ${richTextToMarkdown(payload.rich_text)}`);
        break;
      case 'bulleted_list_item':
      case 'numbered_list_item': {
        const marker = type === 'bulleted_list_item' ? '-' : '1.';
        const t = richTextToMarkdown(payload.rich_text);
        out.push(`${pad}${marker} ${t}`);
        if (block.children?.length) { out.push(...renderBlocks(block.children, level + 1)); }
        break;
      }
      case 'to_do': {
        const t = richTextToMarkdown(payload.rich_text);
        const checked = payload.checked === true ? '[x]' : '[ ]';
        out.push(`${pad}- ${checked} ${t}`);
        if (block.children?.length) { out.push(...renderBlocks(block.children, level + 1)); }
        break;
      }
      case 'toggle': {
        const t = richTextToMarkdown(payload.rich_text);
        out.push(`${pad}**▸ ${t}**`);
        if (block.children?.length) { out.push(...renderBlocks(block.children, level + 1)); }
        break;
      }
      case 'code': {
        const lang = payload.language ?? '';
        out.push(`${pad}\`\`\`${lang}`, richTextToMarkdown(payload.rich_text), '```');
        break;
      }
      case 'quote': {
        const t = richTextToMarkdown(payload.rich_text);
        out.push(`${pad}> ${t}`);
        if (block.children?.length) { out.push(...renderBlocks(block.children, level + 1)); }
        break;
      }
      case 'callout': {
        const t = richTextToMarkdown(payload.rich_text);
        const icon = payload.icon?.emoji ?? '';
        out.push(`${pad}> ${icon ? `${icon} ` : ''}${t}`);
        if (block.children?.length) { out.push(...renderBlocks(block.children, level + 1)); }
        break;
      }
      case 'divider':
        out.push('---');
        break;
      case 'table': {
        const rows = (block.children ?? []).filter(c => c.type === 'table_row');
        rows.forEach((row, i) => {
          const cellsPayload = (row.table_row as { cells?: RichTextSegment[][] } | undefined)?.cells ?? [];
          const cells = cellsPayload.map(c => richTextToMarkdown(c).replace(/\|/g, '\\|'));
          out.push(`| ${cells.join(' | ')} |`);
          if (i === 0) {
            out.push(`| ${cells.map(() => '---').join(' | ')} |`);
          }
        });
        break;
      }
      case 'child_page': {
        out.push(`## ${payload.title || 'Child page'}`);
        break;
      }
      case 'child_database': {
        out.push(`## ${payload.title || 'Child database'}`);
        break;
      }
      case 'column_list':
      case 'column':
      case 'synced_block':
      case 'template': {
        if (block.children?.length) { out.push(...renderBlocks(block.children, level)); }
        else {
          const t = richTextToMarkdown(payload.rich_text);
          if (t) { out.push(`${pad}${t}`); }
        }
        break;
      }
      case 'bookmark':
      case 'embed':
      case 'link_preview': {
        const url = payload.url ?? '';
        const cap = richTextToMarkdown(payload.caption);
        out.push(`[${cap || url}](${url})`);
        break;
      }
      case 'image':
      case 'video':
      case 'file':
      case 'pdf':
      case 'audio': {
        const { url, name } = mediaUrl(payload);
        const cap = richTextToMarkdown(payload.caption) || name;
        out.push(`![${cap}](${url})`);
        break;
      }
      case 'equation': {
        out.push(`$$${payload.expression ?? ''}$$`);
        break;
      }
      default:
        // Unknown / unsupported block type — skipped silently.
        break;
    }
    out.push('');
  }

  return out;
}

async function collectBlockTree(config: Config, blockId: string, depth = 0): Promise<NotionBlock[]> {
  if (depth > 6) { return []; }
  const blocks = await fetchBlockChildren(config, blockId);
  for (const block of blocks) {
    if (block.has_children && CHILD_BLOCK_TYPES.has(block.type)) {
      block.children = await collectBlockTree(config, block.id, depth + 1);
    }
  }
  return blocks;
}

async function pageBodyMarkdown(config: Config, pageId: string): Promise<string> {
  const blocks = await collectBlockTree(config, pageId);
  return renderBlocks(blocks).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ============================================================================
// COMMENTS
// ============================================================================

async function commentsToMarkdown(config: Config, pageId: string, key: string): Promise<string> {
  const comments = await fetchComments(config, pageId);
  const lines: string[] = [`# Comments for ${key}`, '', '---', ''];

  if (comments.length === 0) {
    lines.push('_No comments_');
  }
  else {
    for (const comment of comments) {
      const author = await resolveUserName(config, comment.created_by?.id ?? '');
      const date = new Date(comment.created_time).toLocaleString();
      const body = richTextToMarkdown(comment.rich_text);
      lines.push(`### ${author} - ${date}`, '', body, '', '---', '');
    }
  }

  lines.push('', SYNC_FOOTER, '');
  return lines.join('\n');
}

// ============================================================================
// SLUG, FOLDERS & FILE OPERATIONS
// ============================================================================

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function folderNameFor(slug: string, key: string, title: string): string {
  const prefix = FOLDER_PREFIX[slug] ?? slug.toUpperCase();
  return `${prefix}-${key}-${generateSlug(title)}`;
}

/** Reuses an existing folder across title renames by matching the stable `PREFIX-<key>-` prefix. */
function findExistingFolderByPrefix(searchDir: string, prefix: string): string | null {
  if (!existsSync(searchDir)) { return null; }
  try {
    const entries = readdirSync(searchDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(prefix)) {
        return join(searchDir, entry.name);
      }
    }
  }
  catch {
    // Directory doesn't exist or can't be read
  }
  return null;
}

function resolveOrCreateFolder(baseDir: string, folderName: string, key: string, slug: string): string {
  const prefix = `${FOLDER_PREFIX[slug] ?? slug.toUpperCase()}-${key}-`;
  const existing = findExistingFolderByPrefix(baseDir, prefix);
  if (existing) { return existing; }
  const path = join(baseDir, folderName);
  ensureDir(path);
  return path;
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function writeIndexFile(filePath: string, content: string, dryRun: boolean): 'created' | 'updated' {
  const exists = existsSync(filePath);
  if (!dryRun) { writeFileSync(filePath, content, 'utf-8'); }
  return exists ? 'updated' : 'created';
}

// ============================================================================
// PAGE ENRICHMENT
// ============================================================================

async function enrichPage(
  config: Config,
  page: NotionPage,
  schema: DatabaseSchema,
  slug: string,
  includeComments: boolean,
  manifest: Manifest,
): Promise<PageData> {
  const key = shortKey(page.id);
  const parentName = manifest.database.parent_property;
  const defectsName = manifest.database.related_defects_property;
  const bodyMd = await pageBodyMarkdown(config, page.id);
  const commentsMd = includeComments ? await commentsToMarkdown(config, page.id, key) : null;
  return {
    id: page.id,
    page,
    schema,
    slug,
    key,
    folderName: folderNameFor(slug, key, page.title),
    title: page.title,
    parentId: getRelationIds(page, parentName)[0] ?? null,
    relatedDefectIds: getRelationIds(page, defectsName),
    bodyMd,
    commentsMd,
  };
}

function classifyPage(schema: DatabaseSchema, page: NotionPage, manifest: Manifest, registry: Map<string, RegistryEntry>, dbRole: 'main' | 'bugs'): string | null {
  const typeName = manifest.database.item_type_property;
  const def = schema.properties[typeName];
  if (!def) {
    return dbRole === 'bugs' ? 'bug' : null;
  }
  const value = getSingleOptionName(page, typeName);
  if (!value) {
    return dbRole === 'bugs' ? 'bug' : null;
  }
  const entry = registry.get(value.trim());
  return entry?.slug ?? null;
}

function isCoverable(registry: Map<string, RegistryEntry>, slug: string): boolean {
  return registry.get(slug)?.coverable === true && slug !== 'defect';
}

// ============================================================================
// FILTER BUILDING
// ============================================================================

function buildSinglePropertyFilter(name: string, type: string, value: string): object | undefined {
  switch (type) {
    case 'select':
      return { property: name, select: { equals: value } };
    case 'status':
      return { property: name, status: { equals: value } };
    case 'title':
      return { property: name, title: { contains: value } };
    case 'rich_text':
      return { property: name, rich_text: { contains: value } };
    case 'url':
      return { property: name, url: { contains: value } };
    case 'number': {
      const n = Number(value);
      if (Number.isNaN(n)) { throw new TypeError(`Cannot filter number property "${name}" with "${value}"`); }
      return { property: name, number: { equals: n } };
    }
    case 'multi_select':
      return { property: name, multi_select: { contains: value } };
    case 'people':
      return { property: name, people: { contains: value } };
    case 'relation':
      return { property: name, relation: { contains: value } };
    default:
      return undefined;
  }
}

function buildDatabaseFilter(config: Config, manifest: Manifest, schema: DatabaseSchema, queryFilter?: string, sprint?: string): unknown {
  const clauses: object[] = [];

  if (queryFilter) {
    const eq = queryFilter.indexOf('=');
    if (eq === -1) {
      throw new Error(`Invalid filter "${queryFilter}" — expected "Property=Value"`);
    }
    const prop = queryFilter.slice(0, eq).trim();
    const value = queryFilter.slice(eq + 1).trim();
    const name = resolvePropertyName(manifest, schema, prop);
    const def = name ? schema.properties[name] : undefined;
    if (!name || !def) {
      throw new Error(`Property "${prop}" not found in the database schema`);
    }
    const filter = buildSinglePropertyFilter(name, def.type, value);
    if (filter) { clauses.push(filter); }
  }

  if (sprint) {
    const name = manifest.database.sprint_property;
    const def = schema.properties[name];
    if (!def) {
      throw new Error(`Sprint property "${name}" not found in the database schema — declare it in .agents/notion-required.yaml (database.sprint_property)`);
    }
    const filter = buildSinglePropertyFilter(name, def.type, sprint);
    if (filter) { clauses.push(filter); }
  }

  if (clauses.length === 0) { return undefined; }
  return clauses.length === 1 ? clauses[0] : { and: clauses };
}

// ============================================================================
// FIELD FILE PLANNING & WRITING
// ============================================================================

const STORY_FIELD_FILES: FieldFileSpec[] = [
  { slug: 'acceptance_criteria', file: 'acceptance-criteria.md', title: 'Acceptance Criteria' },
  { slug: 'business_rules_specification', file: 'business-rules.md', title: 'Business Rules' },
  { slug: 'scope', file: 'scope.md', title: 'Scope' },
  { slug: 'out_of_scope', file: 'out-of-scope.md', title: 'Out Of Scope' },
  { slug: 'workflow', file: 'workflow.md', title: 'Workflow' },
  { slug: 'mockup', file: 'mockup.md', title: 'Mockup' },
  { slug: 'spec_implementation_plan', file: 'implementation-plan.md', title: 'Implementation Plan (Dev)' },
  { slug: 'acceptance_test_plan', file: 'acceptance-test-plan.md', title: 'Acceptance Test Plan (QA)' },
  { slug: 'acceptance_test_results', file: 'acceptance-test-results.md', title: 'Acceptance Test Results (QA)' },
];

const EPIC_FIELD_FILES: FieldFileSpec[] = [
  { slug: 'feature_implementation_plan', file: 'feature-implementation-plan.md', title: 'Feature Implementation Plan (Dev)' },
  { slug: 'feature_test_plan', file: 'feature-test-plan.md', title: 'Feature Test Plan (QA)' },
];

const COVERABLE_FIELD_FILES: FieldFileSpec[] = [
  { slug: 'acceptance_test_plan', file: 'acceptance-test-plan.md', title: 'Acceptance Test Plan (QA)' },
  { slug: 'acceptance_test_results', file: 'acceptance-test-results.md', title: 'Acceptance Test Results (QA)' },
];

function readFieldContent(d: PageData, propName: string, type: string): string | null {
  switch (type) {
    case 'rich_text':
    case 'title': {
      const s = getText(d.page, propName);
      return s || null;
    }
    case 'url':
      return getUrl(d.page, propName);
    case 'number': {
      const n = getNumber(d.page, propName);
      return n === null ? null : String(n);
    }
    case 'select':
    case 'status':
      return getSingleOptionName(d.page, propName);
    default:
      return getText(d.page, propName) || null;
  }
}

function planFieldFiles(manifest: Manifest, d: PageData, specs: FieldFileSpec[]): PlannedFieldFile[] {
  return specs
    .map((spec) => {
      const field = fieldByName(manifest, spec.slug);
      if (!field) { return { spec, content: null, stub: false }; }
      const prop = field.name ? d.schema.properties[field.name] : undefined;
      if (prop) {
        return { spec, content: readFieldContent(d, field.name, field.type), stub: false };
      }
      return { spec, content: null, stub: field.fallback != null };
    })
    .filter(p => p.content || p.stub);
}

function renderFieldFile(d: PageData, manifest: Manifest, spec: FieldFileSpec, content: string): string {
  const field = fieldByName(manifest, spec.slug);
  return [
    `# ${d.key} — ${spec.title}`,
    '',
    `> Notion property: \`${field?.name ?? spec.slug}\` · [Open page](${d.page.url ?? ''})`,
    '',
    content.trim(),
    '',
    '---',
    SYNC_FOOTER,
    '',
  ].join('\n');
}

function renderFallbackStub(d: PageData, manifest: Manifest, spec: FieldFileSpec): string {
  const field = fieldByName(manifest, spec.slug);
  const target = field?.fallback?.target === 'body' ? 'page body' : 'page comment';
  const label = field?.fallback?.label ?? spec.title;
  return [
    `# ${d.key} — ${spec.title}`,
    '',
    `> Notion property \`${field?.name ?? spec.slug}\` is not configured in this workspace.`,
    `> Content is written to the page ${target} as \`## ${label}\` per \`.agents/notion-required.yaml\`.`,
    '',
    '---',
    SYNC_FOOTER,
    '',
  ].join('\n');
}

function writePlannedFieldFiles(folderPath: string, manifest: Manifest, d: PageData, planned: PlannedFieldFile[], options: SyncOptions, result: SyncResult): void {
  for (const p of planned) {
    const filePath = join(folderPath, p.spec.file);
    const md = p.stub
      ? renderFallbackStub(d, manifest, p.spec)
      : renderFieldFile(d, manifest, p.spec, p.content ?? '');
    const status = writeIndexFile(filePath, md, options.dryRun);
    if (status === 'created') { result.files.created++; }
    else { result.files.updated++; }
  }
}

// ============================================================================
// MARKDOWN GENERATORS
// ============================================================================

async function renderMetadataLines(d: PageData, config: Config, manifest: Manifest): Promise<string[]> {
  const db = manifest.database;
  const lines: string[] = ['## Metadata', ''];

  lines.push(`- **Created:** ${d.page.created_time ? new Date(d.page.created_time).toLocaleDateString() : 'Unknown'}`);
  lines.push(`- **Updated:** ${d.page.last_edited_time ? new Date(d.page.last_edited_time).toLocaleDateString() : 'Unknown'}`);

  const status = getSingleOptionName(d.page, db.status_property);
  if (status) { lines.push(`- **Status:** ${status}`); }
  const priority = getSingleOptionName(d.page, db.priority_property);
  if (priority) { lines.push(`- **Priority:** ${priority}`); }
  const sprint = getSingleOptionName(d.page, db.sprint_property);
  if (sprint) { lines.push(`- **Sprint:** ${sprint}`); }

  const assignee = await getPeopleNames(config, d.page, db.assignee_property);
  lines.push(`- **Assignee:** ${assignee.join(', ') || 'Unassigned'}`);
  const qaAssignee = await getPeopleNames(config, d.page, db.qa_assignee_property);
  if (qaAssignee.length) { lines.push(`- **QA Assignee:** ${qaAssignee.join(', ')}`); }

  const components = getMultiSelectNames(d.page, db.components_property);
  if (components.length) { lines.push(`- **Components:** ${components.join(', ')}`); }
  const labels = getMultiSelectNames(d.page, db.labels_property);
  if (labels.length) { lines.push(`- **Labels:** ${labels.join(', ')}`); }

  return lines;
}

function renderOverview(d: PageData): string[] {
  return ['---', '', '## Overview', '', d.bodyMd || '_No description provided_', ''];
}

function renderFieldsManifest(present: FieldFileSpec[]): string[] {
  if (present.length === 0) { return []; }
  return [
    '---',
    '',
    '## Fields',
    '',
    '> Each field is a separate file in this folder.',
    '',
    ...present.map(spec => `- [${spec.title}](./${spec.file})`),
    '',
  ];
}

function renderRelatedDefects(nested: PageData[]): string[] {
  if (nested.length === 0) { return []; }
  return [
    '---',
    '',
    '## Related Defects',
    '',
    ...nested.map(def => `- [${def.title}](${def.page.url ?? ''})`),
    '',
  ];
}

function renderFooter(): string[] {
  return ['---', '', SYNC_FOOTER, ''];
}

async function generateStoryMarkdown(
  d: PageData,
  config: Config,
  manifest: Manifest,
  epic: { title: string, url?: string } | null,
  present: FieldFileSpec[],
  nestedDefects: PageData[],
): Promise<string> {
  const db = manifest.database;
  const storyPointsField = fieldByName(manifest, 'story_points');
  const weblinkField = fieldByName(manifest, 'weblink');
  const storyPoints = storyPointsField ? getNumber(d.page, storyPointsField.name) : null;
  const webLink = weblinkField ? getUrl(d.page, weblinkField.name) : null;

  const lines: string[] = [`# ${d.title}`, ''];
  lines.push(`**Notion Key:** [${d.key}](${d.page.url ?? ''})`);
  if (epic) { lines.push(`**Epic:** [${epic.title}](${epic.url ?? ''})`); }
  lines.push(
    `**Type:** ${notionTypeName(manifest, d.slug)}`,
    `**Status:** ${getSingleOptionName(d.page, db.status_property) ?? 'Unknown'}`,
    `**Priority:** ${getSingleOptionName(d.page, db.priority_property) ?? 'Not set'}`,
    `**Story Points:** ${storyPoints ?? '-'}`,
  );
  if (webLink) { lines.push(`**Web Link:** ${webLink}`); }

  lines.push('', ...renderOverview(d));
  lines.push(...renderFieldsManifest(present));
  lines.push(...renderRelatedDefects(nestedDefects));

  const metadata = await renderMetadataLines(d, config, manifest);
  lines.push('', ...metadata, '', ...renderFooter());

  return lines.join('\n');
}

async function generateEpicMarkdown(
  d: PageData,
  config: Config,
  manifest: Manifest,
  childStories: PageData[],
  present: FieldFileSpec[],
): Promise<string> {
  const db = manifest.database;
  const lines: string[] = [
    `# ${d.title}`,
    '',
    `**Notion Key:** [${d.key}](${d.page.url ?? ''})`,
    `**Type:** ${notionTypeName(manifest, d.slug)}`,
    `**Status:** ${getSingleOptionName(d.page, db.status_property) ?? 'Unknown'}`,
    `**Priority:** ${getSingleOptionName(d.page, db.priority_property) ?? 'Not set'}`,
    '',
  ];

  if (childStories.length > 0) {
    lines.push('---', '', '## User Stories', '');
    for (const story of childStories) {
      lines.push(`- [${story.title}](${story.page.url ?? ''})`);
    }
    lines.push('');
  }

  lines.push(...renderOverview(d));
  lines.push(...renderFieldsManifest(present));

  const metadata = await renderMetadataLines(d, config, manifest);
  lines.push('', ...metadata, '', ...renderFooter());

  return lines.join('\n');
}

async function generateCoverableMarkdown(
  d: PageData,
  config: Config,
  manifest: Manifest,
  label: string,
  nestedDefects: PageData[],
  parent: { title: string, url?: string } | null,
): Promise<string> {
  const db = manifest.database;
  const field = (slug: string) => fieldByName(manifest, slug);

  const actual = field('actual_result') ? readFieldContent(d, field('actual_result')!.name, field('actual_result')!.type) : null;
  const expected = field('expected_result') ? readFieldContent(d, field('expected_result')!.name, field('expected_result')!.type) : null;
  const errorType = field('error_type') ? getSingleOptionName(d.page, field('error_type')!.name) : null;
  const severity = field('severity') ? getSingleOptionName(d.page, field('severity')!.name) : null;
  const testEnv = field('test_environment') ? getSingleOptionName(d.page, field('test_environment')!.name) : null;
  const rootCause = field('root_cause') ? getSingleOptionName(d.page, field('root_cause')!.name) : null;
  const workaround = field('workaround') ? readFieldContent(d, field('workaround')!.name, field('workaround')!.type) : null;
  const evidence = field('evidence') ? readFieldContent(d, field('evidence')!.name, field('evidence')!.type) : null;
  const fixType = field('fix') ? getSingleOptionName(d.page, field('fix')!.name) : null;

  const components = getMultiSelectNames(d.page, db.components_property);

  const lines: string[] = [
    `# ${label}: ${d.title}`,
    '',
    `**Notion Key:** [${d.key}](${d.page.url ?? ''})`,
    `**Priority:** ${getSingleOptionName(d.page, db.priority_property) ?? 'Not set'}`,
    `**Status:** ${getSingleOptionName(d.page, db.status_property) ?? 'Unknown'}`,
    `**Components:** ${components.join(', ') || 'None'}`,
  ];

  if (severity) { lines.push(`**Severity:** ${severity}`); }
  if (errorType) { lines.push(`**Error Type:** ${errorType}`); }
  if (testEnv) { lines.push(`**Test Environment:** ${testEnv}`); }
  if (fixType) { lines.push(`**Fix Type:** ${fixType}`); }

  lines.push('', '---', '', '## Description', '', d.bodyMd || '_No description provided_', '');

  if (actual) { lines.push('---', '', '## 🐞 Actual Result', '', actual, ''); }
  if (expected) { lines.push('---', '', '## ✅ Expected Result', '', expected, ''); }
  if (rootCause) { lines.push('---', '', '## 🔍 Root Cause', '', `**Category:** ${rootCause}`, ''); }
  if (workaround) { lines.push('---', '', '## 🚩 Workaround', '', workaround, ''); }
  if (evidence) { lines.push('---', '', '## 🧫 Evidence', '', evidence, ''); }

  if (parent) { lines.push('---', '', '## Parent', '', `- [${parent.title}](${parent.url ?? ''})`, ''); }
  lines.push(...renderRelatedDefects(nestedDefects));

  const metadata = await renderMetadataLines(d, config, manifest);
  lines.push('', ...metadata, '', ...renderFooter());

  return lines.join('\n');
}

// ============================================================================
// RENDERING
// ============================================================================

function bodyFileName(slug: string): string {
  switch (slug) {
    case 'bug': return 'bug.md';
    case 'improvement': return 'improvement.md';
    case 'tech_story': return 'tech-story.md';
    case 'tech_debt': return 'tech-debt.md';
    default: return 'body.md';
  }
}

async function renderStory(
  config: Config,
  manifest: Manifest,
  d: PageData,
  epicFolderPath: string,
  epic: { title: string, url?: string } | null,
  nestedDefects: PageData[],
  options: SyncOptions,
  result: SyncResult,
): Promise<void> {
  const storiesDir = join(epicFolderPath, 'stories');
  const folderPath = resolveOrCreateFolder(storiesDir, d.folderName, d.key, d.slug);
  const planned = planFieldFiles(manifest, d, STORY_FIELD_FILES);
  const md = await generateStoryMarkdown(d, config, manifest, epic, planned.map(p => p.spec), nestedDefects);
  const status = writeIndexFile(join(folderPath, 'story.md'), md, options.dryRun);
  if (status === 'created') { result.files.created++; }
  else { result.files.updated++; }

  writePlannedFieldFiles(folderPath, manifest, d, planned, options, result);

  if (d.commentsMd) {
    const statusComments = writeIndexFile(join(folderPath, 'comments.md'), d.commentsMd, options.dryRun);
    if (statusComments === 'created') { result.files.created++; }
    else { result.files.updated++; }
  }

  await renderNestedDefects(config, manifest, d, nestedDefects, join(folderPath, 'defects'), options, result);
}

async function renderEpic(
  config: Config,
  manifest: Manifest,
  d: PageData,
  childStories: PageData[],
  options: SyncOptions,
  result: SyncResult,
): Promise<void> {
  const epicsDir = join(config.outputDir, 'epics');
  const folderPath = resolveOrCreateFolder(epicsDir, d.folderName, d.key, d.slug);
  const planned = planFieldFiles(manifest, d, EPIC_FIELD_FILES);
  const md = await generateEpicMarkdown(d, config, manifest, childStories, planned.map(p => p.spec));
  const status = writeIndexFile(join(folderPath, 'epic.md'), md, options.dryRun);
  if (status === 'created') { result.files.created++; }
  else { result.files.updated++; }

  writePlannedFieldFiles(folderPath, manifest, d, planned, options, result);

  if (d.commentsMd) {
    const statusComments = writeIndexFile(join(folderPath, 'comments.md'), d.commentsMd, options.dryRun);
    if (statusComments === 'created') { result.files.created++; }
    else { result.files.updated++; }
  }
}

async function renderCoverable(
  config: Config,
  manifest: Manifest,
  d: PageData,
  nestedDefects: PageData[],
  options: SyncOptions,
  result: SyncResult,
): Promise<void> {
  const dir = localDirFor(new Map(), d.slug);
  const coverDir = join(config.outputDir, dir);
  const folderPath = resolveOrCreateFolder(coverDir, d.folderName, d.key, d.slug);
  const planned = planFieldFiles(manifest, d, COVERABLE_FIELD_FILES);
  const label = notionTypeName(manifest, d.slug).toUpperCase();
  const md = await generateCoverableMarkdown(d, config, manifest, label, nestedDefects, null);
  const status = writeIndexFile(join(folderPath, bodyFileName(d.slug)), md, options.dryRun);
  if (status === 'created') { result.files.created++; }
  else { result.files.updated++; }

  writePlannedFieldFiles(folderPath, manifest, d, planned, options, result);

  if (d.commentsMd) {
    const statusComments = writeIndexFile(join(folderPath, 'comments.md'), d.commentsMd, options.dryRun);
    if (statusComments === 'created') { result.files.created++; }
    else { result.files.updated++; }
  }

  await renderNestedDefects(config, manifest, d, nestedDefects, join(folderPath, 'defects'), options, result);
}

async function renderNestedDefects(
  config: Config,
  manifest: Manifest,
  parent: PageData,
  nestedDefects: PageData[],
  defectsDir: string,
  options: SyncOptions,
  result: SyncResult,
): Promise<void> {
  if (options.noDefects || nestedDefects.length === 0) { return; }
  ensureDir(defectsDir);
  for (const def of nestedDefects) {
    const fileName = `DEFECT-${def.key}-${generateSlug(def.title)}.md`;
    const md = await generateCoverableMarkdown(def, config, manifest, 'DEFECT', [], { title: parent.title, url: parent.page.url });
    const status = writeIndexFile(join(defectsDir, fileName), md, options.dryRun);
    if (status === 'created') { result.files.created++; }
    else { result.files.updated++; }
  }
}

async function renderStandaloneDefects(
  config: Config,
  manifest: Manifest,
  defects: PageData[],
  options: SyncOptions,
  result: SyncResult,
): Promise<void> {
  if (options.noDefects || defects.length === 0) { return; }
  const defectsDir = join(config.outputDir, 'defects');
  ensureDir(defectsDir);
  for (const def of defects) {
    const fileName = `DEFECT-${def.key}-${generateSlug(def.title)}.md`;
    const md = await generateCoverableMarkdown(def, config, manifest, 'DEFECT', [], null);
    const status = writeIndexFile(join(defectsDir, fileName), md, options.dryRun);
    if (status === 'created') { result.files.created++; }
    else { result.files.updated++; }
  }
}

function generateEpicTree(
  config: Config,
  manifest: Manifest,
  epics: PageData[],
  orphans: PageData[],
  coverables: PageData[],
  standaloneDefects: PageData[],
): string {
  const lines: string[] = ['# PBI — Epic Tree', '', SYNC_FOOTER, ''];

  if (epics.length > 0) {
    lines.push('## Epics', '');
    for (const epic of epics) {
      const folder = findExistingFolderByPrefix(join(config.outputDir, 'epics'), `EPIC-${epic.key}-`) ?? epic.folderName;
      const status = getSingleOptionName(epic.page, manifest.database.status_property) ?? 'Unknown';
      lines.push(`- [${epic.title}](epics/${folder}/epic.md) — ${status}`);
    }
    lines.push('');
  }

  if (orphans.length > 0) {
    lines.push('## Orphan Stories', '');
    for (const story of orphans) {
      const status = getSingleOptionName(story.page, manifest.database.status_property) ?? 'Unknown';
      lines.push(`- [${story.title}](epics/_orphans/${story.folderName}/story.md) — ${status}`);
    }
    lines.push('');
  }

  if (coverables.length > 0) {
    lines.push('## Bugs / Improvements / Tech Stories / Tech Debts', '');
    for (const c of coverables) {
      const dir = localDirFor(new Map(), c.slug);
      const folder = findExistingFolderByPrefix(join(config.outputDir, dir), `${FOLDER_PREFIX[c.slug]}-${c.key}-`) ?? c.folderName;
      const status = getSingleOptionName(c.page, manifest.database.status_property) ?? 'Unknown';
      lines.push(`- [${c.title}](${dir}/${folder}/${bodyFileName(c.slug)}) — ${status}`);
    }
    lines.push('');
  }

  if (standaloneDefects.length > 0) {
    lines.push('## Standalone Defects', '');
    for (const def of standaloneDefects) {
      lines.push(`- [${def.title}](defects/DEFECT-${def.key}-${generateSlug(def.title)}.md)`);
    }
    lines.push('');
  }

  lines.push(renderFooter()[0]);
  return lines.join('\n');
}

// ============================================================================
// SYNC PIPELINE
// ============================================================================

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = Array.from<R>({ length: items.length });
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => worker());
  await Promise.all(workers);
  return results;
}

interface DatabaseRef {
  id: string
  role: 'main' | 'bugs'
}

function databaseRefs(config: Config): DatabaseRef[] {
  const refs: DatabaseRef[] = [{ id: config.databaseId, role: 'main' }];
  if (config.bugsDatabaseId) { refs.push({ id: config.bugsDatabaseId, role: 'bugs' }); }
  return refs;
}

interface ClassifiedPage {
  page: NotionPage
  schema: DatabaseSchema
  slug: string
}

async function loadClassifiedPages(config: Config, manifest: Manifest, registry: Map<string, RegistryEntry>, filter?: unknown): Promise<ClassifiedPage[]> {
  const classified: ClassifiedPage[] = [];
  for (const db of databaseRefs(config)) {
    const schema = await fetchDatabase(config, db.id);
    const pages = await queryDatabasePages(config, db.id, db.role === 'main' ? filter : undefined);
    for (const page of pages) {
      const slug = classifyPage(schema, page, manifest, registry, db.role);
      if (!slug) {
        log.warn(`Skipping page "${page.title}" — no work-type match (item_type_property "${manifest.database.item_type_property}" unresolved or unknown value)`);
        continue;
      }
      classified.push({ page, schema, slug });
    }
  }
  return classified;
}

async function runPull(config: Config, classified: ClassifiedPage[], options: SyncOptions, scoped: boolean): Promise<SyncResult> {
  const started = Date.now();
  const manifest = loadManifest();
  const registry = buildRegistry(manifest);
  const result: SyncResult = {
    success: true,
    synced: 0,
    files: { created: 0, updated: 0, skipped: 0 },
    types: {},
    warnings: [],
    duration_ms: 0,
  };

  // Determine which work-type slugs are in scope (default scope + extra --types).
  const scope = new Set<string>(['epic', 'story', 'bug']);
  for (const t of options.types) { scope.add(t); }
  if (options.subcommand) {
    const subToSlug: Record<string, string> = { stories: 'story', bugs: 'bug', defects: 'defect', improvements: 'improvement' };
    const s = subToSlug[options.subcommand];
    if (s) {
      scope.clear();
      scope.add(s);
    }
  }
  const scopeCoverables = new Set<string>([...scope].filter(slug => isCoverable(registry, slug)));

  // Defect discovery: a defect is nested when its Parent relation points at an
  // in-scope coverable, or when an in-scope coverable's Related Defects relation
  // lists it. Compute which defects are reachable BEFORE enriching, so a default
  // `pull` syncs nested defects without loading every defect page in the board.
  const classifiedById = new Map(classified.map(c => [c.page.id, c]));
  const reachableDefectIds = new Set<string>();
  if (!options.noDefects) {
    for (const c of classified) {
      if (!scopeCoverables.has(c.slug)) { continue; }
      for (const id of getRelationIds(c.page, manifest.database.related_defects_property)) {
        const target = classifiedById.get(id);
        if (target && target.slug === 'defect') { reachableDefectIds.add(id); }
      }
      for (const other of classified) {
        if (other.slug === 'defect' && getRelationIds(other.page, manifest.database.parent_property)[0] === c.page.id) {
          reachableDefectIds.add(other.page.id);
        }
      }
    }
  }

  // Enrich every in-scope page (fetch blocks + comments) with bounded concurrency.
  const toSync = classified.filter((c) => {
    if (c.slug === 'defect') {
      if (options.noDefects) { return false; }
      return scope.has('defect') || reachableDefectIds.has(c.page.id);
    }
    return scope.has(c.slug);
  });

  const byId = new Map<string, PageData>();
  const enriched = await mapWithConcurrency(toSync, 4, async (c) => {
    const d = await enrichPage(config, c.page, c.schema, c.slug, options.includeComments, manifest);
    byId.set(c.page.id, d);
    return d;
  });

  // Related-defects discovery: a defect is nested when its Parent relation points
  // at an in-scope coverable, or when an in-scope coverable's Related Defects
  // relation lists it. All other defects are either standalone (pulled with
  // `pull defects` / --types defect) or reported as orphans.
  const coverableById = new Map<string, PageData>();
  for (const d of enriched) {
    if (isCoverable(registry, d.slug)) { coverableById.set(d.id, d); }
  }
  const nestedIds = new Set<string>();
  const defectsByParent = new Map<string, PageData[]>();
  for (const d of enriched) {
    if (d.slug !== 'defect') { continue; }
    let parentId = d.parentId && coverableById.has(d.parentId) ? d.parentId : null;
    if (!parentId) {
      for (const [pid, coverable] of coverableById) {
        if (coverable.relatedDefectIds.includes(d.id)) { parentId = pid; break; }
      }
    }
    if (parentId) {
      nestedIds.add(d.id);
      const list = defectsByParent.get(parentId) ?? [];
      list.push(d);
      defectsByParent.set(parentId, list);
    }
  }

  // Route into buckets.
  const epics: PageData[] = [];
  const stories: PageData[] = [];
  const coverables: PageData[] = [];
  const standaloneDefects: PageData[] = [];
  const orphans: PageData[] = [];

  for (const d of enriched) {
    if (d.slug === 'defect') {
      if (!nestedIds.has(d.id)) {
        if (scope.has('defect')) { standaloneDefects.push(d); }
        else {
          result.warnings.push(`Orphan Defect "${d.title}" (${d.key}) has no coverable parent — re-link it in Notion (${manifest.database.related_defects_property} relation).`);
        }
      }
      continue;
    }
    if (d.slug === 'epic') { epics.push(d); }
    else if (d.slug === 'story') {
      const epicParent = d.parentId ? byId.get(d.parentId) : undefined;
      if (epicParent && epicParent.slug === 'epic') { stories.push(d); }
      else {
        orphans.push(d);
        result.warnings.push(`Story "${d.title}" (${d.key}) has no Epic parent — rendered under epics/_orphans/.`);
      }
    }
    else { coverables.push(d); }
  }

  // Render epics + their stories.
  const epicById = new Map(epics.map(e => [e.id, e]));
  for (const epic of epics) {
    const children = stories.filter(s => s.parentId === epic.id);
    await renderEpic(config, manifest, epic, children, options, result);
  }
  for (const story of stories) {
    const epic = story.parentId ? epicById.get(story.parentId) : undefined;
    const epicFolder = epic
      ? (findExistingFolderByPrefix(join(config.outputDir, 'epics'), `EPIC-${epic.key}-`) ?? join('epics', epic.folderName))
      : join('epics', '_orphans');
    const epicSummary = epic ? { title: epic.title, url: epic.page.url } : null;
    await renderStory(config, manifest, story, join(config.outputDir, epicFolder), epicSummary, defectsByParent.get(story.id) ?? [], options, result);
  }
  for (const story of orphans) {
    await renderStory(config, manifest, story, join(config.outputDir, 'epics', '_orphans'), null, defectsByParent.get(story.id) ?? [], options, result);
  }
  for (const coverable of coverables) {
    await renderCoverable(config, manifest, coverable, defectsByParent.get(coverable.id) ?? [], options, result);
  }
  if (scope.has('defect') && !options.noDefects) {
    await renderStandaloneDefects(config, manifest, standaloneDefects, options, result);
  }

  // Master index (full pulls only).
  if (!scoped) {
    const tree = generateEpicTree(config, manifest, epics, orphans, coverables, standaloneDefects);
    const treeStatus = writeIndexFile(join(config.outputDir, 'epic-tree.md'), tree, options.dryRun);
    if (treeStatus === 'created') { result.files.created++; }
    else { result.files.updated++; }
  }

  // Counts.
  result.synced = enriched.length;
  for (const d of enriched) {
    result.types[d.slug] = (result.types[d.slug] ?? 0) + 1;
  }
  result.duration_ms = Date.now() - started;
  result.success = result.warnings.length === 0;

  return result;
}

// ============================================================================
// COMMANDS
// ============================================================================

async function cmdStatus(): Promise<void> {
  log.title('Notion Sync - Configuration Status');
  log.line('─'.repeat(40));

  try {
    const config = getConfig();
    const manifest = loadManifest();
    const registry = buildRegistry(manifest);

    log.success(`NOTION_TOKEN: ${'*'.repeat(20)}`);
    log.success(`NOTION_DATABASE_ID: ${config.databaseId}`);
    if (config.bugsDatabaseId) { log.success(`NOTION_DATABASE_BUGS_ID: ${config.bugsDatabaseId}`); }
    log.info(`Output: ${config.outputDir}`);

    log.line('');
    log.info('Testing connection...');
    await notionFetch(config, '/users/me');
    log.success('Authenticated with Notion API');

    const schema = await fetchDatabase(config, config.databaseId);
    log.success(`Connected to database "${(schema.title ?? []).map(t => t.plain_text).join('') || config.databaseId}"`);

    log.line('');
    log.title('Database schema vs manifest');
    log.line('─'.repeat(40));

    // Structural properties (database: block)
    for (const [role, name] of Object.entries(manifest.database)) {
      const present = schema.properties[name] !== undefined;
      if (present) { log.success(`${role}: "${name}"`); }
      else { log.warn(`${role}: "${name}" NOT FOUND in schema`); }
    }

    log.line('');
    for (const [slug, field] of Object.entries(manifest.required)) {
      const present = schema.properties[field.name] !== undefined;
      const tag = present ? `${colors.green}✔${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;
      log.line(`${tag} ${slug} (${field.name})${present ? '' : ' — NOT FOUND'}`);
    }

    log.line('');
    log.info(`Work types: ${[...registry.keys()].join(', ')}`);
    log.success('Status OK');
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Missing required environment')) {
      log.error(message);
    }
    else if (message.includes('401')) {
      log.error('Authentication failed. Check NOTION_TOKEN and that the integration is shared with the database.');
    }
    else if (message.includes('404')) {
      log.error('Database not found. Check NOTION_DATABASE_ID and that the integration has access to it.');
    }
    else {
      log.error(`Connection failed: ${message}`);
    }
    process.exit(1);
  }
}

async function cmdPull(config: Config, options: SyncOptions, scoped = false): Promise<void> {
  const manifest = loadManifest();
  const registry = buildRegistry(manifest);

  const filter = buildDatabaseFilter(config, manifest, await fetchDatabase(config, config.databaseId), undefined, options.sprint);
  const classified = await loadClassifiedPages(config, manifest, registry, filter);
  log.info(`Loaded ${classified.length} pages from Notion`);

  if (options.epicKey) {
    const epicKey = options.epicKey;
    const epic = classified.find(c => c.slug === 'epic' && (c.page.id === epicKey || c.page.id.replace(/-/g, '') === epicKey || c.page.id.replace(/-/g, '').startsWith(epicKey.toLowerCase()) || generateSlug(c.page.title) === epicKey.toLowerCase() || c.page.title.toLowerCase() === epicKey.toLowerCase()));
    if (!epic) { log.error(`Epic "${epicKey}" not found`); process.exit(1); }
    const epicId = epic.page.id;
    const sub = classified.filter(c => (c.slug === 'epic' && c.page.id === epicId) || (c.slug === 'story' && getRelationIds(c.page, manifest.database.parent_property).includes(epicId)));
    const result = await runPull(config, sub, options, true);
    finish(result, options);
    return;
  }

  if (options.storyKey) {
    const storyKey = options.storyKey;
    const story = classified.find(c => c.slug === 'story' && (c.page.id === storyKey || c.page.id.replace(/-/g, '') === storyKey || c.page.id.replace(/-/g, '').startsWith(storyKey.toLowerCase()) || generateSlug(c.page.title) === storyKey.toLowerCase() || c.page.title.toLowerCase() === storyKey.toLowerCase()));
    if (!story) { log.error(`Story "${storyKey}" not found`); process.exit(1); }
    const parentId = getRelationIds(story.page, manifest.database.parent_property)[0];
    const sub = classified.filter(c => c.page.id === story.page.id || (parentId && c.page.id === parentId));
    const result = await runPull(config, sub, options, true);
    finish(result, options);
    return;
  }

  const result = await runPull(config, classified, options, scoped);
  finish(result, options);
}

function printResult(result: SyncResult): void {
  log.line('');
  log.line(`Pages synced:   ${result.synced}`);
  log.line(`Files created:  ${result.files.created}`);
  log.line(`Files updated:  ${result.files.updated}`);
  log.line(`Files skipped:  ${result.files.skipped}`);
  log.line(`Duration:       ${(result.duration_ms / 1000).toFixed(1)}s`);
  log.line('');
  for (const warning of result.warnings) { log.warn(warning); }
  if (result.warnings.length > 0) { log.line(''); }
  if (result.success) { log.success('Sync completed'); }
  else { log.error('Sync completed with warnings'); }
}

function finish(result: SyncResult, options: SyncOptions): void {
  if (options.json) { log.json(result); }
  else { printResult(result); }
}

async function cmdGet(config: Config, key: string, options: SyncOptions): Promise<void> {
  const manifest = loadManifest();
  const registry = buildRegistry(manifest);
  const classified = await loadClassifiedPages(config, manifest, registry, undefined);

  const match = classified.find(c =>
    c.page.id === key
    || c.page.id.replace(/-/g, '') === key
    || c.page.id.replace(/-/g, '').startsWith(key.toLowerCase())
    || generateSlug(c.page.title) === key.toLowerCase()
    || c.page.title.toLowerCase() === key.toLowerCase(),
  );

  if (!match) {
    log.error(`Page "${key}" not found. Use a full page id, the short 8-hex id, or the title slug.`);
    process.exit(1);
  }

  log.info(`Syncing "${match.page.title}" (${match.slug})`);

  // Pull a scoped set: the page + its epic parent (for stories) + nested defects.
  const parentId = getRelationIds(match.page, manifest.database.parent_property)[0];
  const sub = classified.filter(c =>
    c.page.id === match.page.id
    || (parentId && c.page.id === parentId)
    || (c.slug === 'defect'
      && (c.page.id === match.page.id
        || getRelationIds(c.page, manifest.database.parent_property)[0] === match.page.id
        || getRelationIds(match.page, manifest.database.related_defects_property).includes(c.page.id))),
  );

  const result = await runPull(config, sub, options, true);
  finish(result, options);
}

async function cmdQuery(config: Config, query: string, options: SyncOptions): Promise<void> {
  const manifest = loadManifest();
  const registry = buildRegistry(manifest);
  const schema = await fetchDatabase(config, config.databaseId);
  const filter = buildDatabaseFilter(config, manifest, schema, query, options.sprint);
  const classified = await loadClassifiedPages(config, manifest, registry, filter);
  log.info(`Loaded ${classified.length} pages matching "${query}"`);
  const result = await runPull(config, classified, options, true);
  finish(result, options);
}

function cmdHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}NOTION SYNC CLI${colors.reset}
Sync Notion board pages to local Markdown files in \`.context/PBI/\`.

${colors.bold}USAGE${colors.reset}
  bun run notion:sync-issues <command> [options]

${colors.bold}COMMANDS${colors.reset}
  status                Check configuration, connection and schema vs manifest
  pull                  Sync Epics, Stories & Bugs (default scope)
    stories             Sync only Stories (and their parents/defects)
    bugs                Sync only Bugs
    defects             Sync all Defects (standalone included)
    improvements        Sync only Improvements
  get <KEY>             Sync ONE page (full id, short 8-hex id or title slug)
  query "Prop=Value"    Sync every page matching a single-property filter
  help                  Show this help message

${colors.bold}PULL OPTIONS${colors.reset}
  --epic <KEY>          Sync one epic with all its stories
  --story <KEY>         Sync one story only
  --include-comments    Include page comments in comments.md
  --dry-run             Show what would be done without writing files
  --json                Output results as JSON
  --sprint <name>       Only pages whose Sprint property equals <name>
  --types <csv>         Extra work types to sync (story,epic,bug,defect,...)
  --no-defects          Skip defect discovery entirely
  --database <id>       Override NOTION_DATABASE_ID

${colors.bold}ENVIRONMENT${colors.reset}
  NOTION_TOKEN          Required. Internal Integration token.
  NOTION_DATABASE_ID    Required. Database id (32-hex UUID from the URL).
  NOTION_DATABASE_BUGS_ID  Optional. Second DB whose pages are all Bugs/Defects.
  NOTION_SYNC_OUTPUT    Output directory (default: .context/PBI).

${colors.dim}Create a token: https://www.notion.so/my-integrations${colors.reset}
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // help / no args must not require credentials.
  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    cmdHelp();
    return;
  }

  // --database takes precedence over NOTION_DATABASE_ID (mirror of --project in sync-jira-issues.ts).
  if (args.database) { process.env.NOTION_DATABASE_ID = args.database; }

  const options: SyncOptions = {
    epicKey: args.epic,
    storyKey: args.story,
    subcommand: args.subcommand,
    includeComments: args.includeComments,
    dryRun: args.dryRun,
    json: args.json,
    sprint: args.sprint,
    types: args.types ?? [],
    noDefects: args.noDefects ?? false,
  };

  // Wire the output dir into options for render helpers.
  let config: Config;
  try {
    config = getConfig();
  }
  catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  try {
    switch (args.command) {
      case 'status':
        await cmdStatus();
        break;
      case 'pull':
        await cmdPull(config, options);
        break;
      case 'get':
        if (!args.getKey) {
          log.error('Usage: bun run notion:sync-issues get <KEY>');
          process.exit(1);
        }
        await cmdGet(config, args.getKey, options);
        break;
      case 'query':
        if (!args.query) {
          log.error('Usage: bun run notion:sync-issues query "Property=Value"');
          process.exit(1);
        }
        await cmdQuery(config, args.query, options);
        break;
      default:
        log.error(`Unknown command: ${args.command}`);
        log.info('Run "bun run notion:sync-issues help" for usage');
        process.exit(1);
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Missing required environment')) {
      log.error(message);
    }
    else if (message.includes('401')) {
      log.error('Authentication failed. Check NOTION_TOKEN and that the integration is shared with the database.');
    }
    else if (message.includes('404')) {
      log.error('Database not found. Check NOTION_DATABASE_ID and that the integration has access to it.');
    }
    else {
      log.error(message);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
