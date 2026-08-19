/**
 * KATA Architecture - Global Teardown (Native Hook)
 *
 * Runs LAST after the whole test suite completes.
 * Generates reports, syncs to TMS, cleans up resources.
 *
 * Implemented as a native `globalTeardown` hook so it is NOT a test
 * and does NOT appear in test reports (Allure, HTML, JSON, JUnit).
 */

import { existsSync, readFileSync } from 'node:fs';

import { ATC_PARTIAL_PATH } from '@utils/decorators';
import { syncResults } from '@utils/jiraSync';

/**
 * Global Teardown: generate reports and sync TMS
 *
 * Generates ATC execution report and syncs results to TMS if enabled.
 */
export default async function globalTeardown(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('KATA Architecture - Global Teardown');
  console.log('='.repeat(60));

  // Read NDJSON directly (KataReporter.onEnd() hasn't fired yet)
  if (existsSync(ATC_PARTIAL_PATH)) {
    try {
      const lines = readFileSync(ATC_PARTIAL_PATH, 'utf-8').split('\n').filter(Boolean);
      const grouped: Record<string, { hasFail: boolean, allSkip: boolean, count: number }> = {};

      for (const line of lines) {
        const entry = JSON.parse(line) as { testId: string, status: string };
        if (!grouped[entry.testId]) {
          grouped[entry.testId] = { hasFail: false, allSkip: true, count: 0 };
        }
        grouped[entry.testId].count++;
        if (entry.status === 'FAIL') {
          grouped[entry.testId].hasFail = true;
        }
        if (entry.status !== 'SKIP') {
          grouped[entry.testId].allSkip = false;
        }
      }

      let passed = 0;
      let failed = 0;
      let skipped = 0;
      let executions = 0;

      for (const g of Object.values(grouped)) {
        executions += g.count;
        if (g.hasFail) {
          failed++;
        }
        else if (g.allSkip) {
          skipped++;
        }
        else {
          passed++;
        }
      }

      const total = Object.keys(grouped).length;

      console.log('\nATC Coverage:');
      console.log(`   ${total} unique ATC tracked (${executions} total executions)`);
      console.log(`   ✅ Passed: ${passed} | ❌ Failed: ${failed} | ⏭️ Skipped: ${skipped}`);
    }
    catch (error) {
      console.warn('[WARN] Could not read ATC partial results:', error);
    }
  }
  else {
    console.log('\n[INFO] No ATC results found (no @atc decorators executed)');
  }

  // Sync results to TMS
  const { AUTO_SYNC } = process.env;

  if (AUTO_SYNC === 'true') {
    console.log('\n[SYNC] Syncing results to TMS...');
    try {
      const result = await syncResults();
      if (result) {
        console.log(`   Provider: ${result.provider}`);
        console.log(`   Status: ${result.success ? 'Success' : 'Failed'}`);
        console.log(`   Message: ${result.message}`);
      }
    }
    catch (error) {
      console.error('[ERROR] TMS sync failed:', error);
    }
  }
  else {
    console.log('\n[SKIP] TMS sync disabled (set AUTO_SYNC=true to enable)');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('[OK] Global teardown complete');
  console.log(`${'='.repeat(60)}\n`);
}
