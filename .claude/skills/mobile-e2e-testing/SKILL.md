---
name: mobile-e2e-testing
description: "Mobile E2E testing strategy, CI pipeline decisions, and framework recommendations. Use when setting up mobile E2E tests, configuring CI for Android/iOS, choosing between Maestro/Detox/Appium, or optimizing mobile CI pipelines. Covers emulator setup, caching strategies, test design patterns, and real-world app testing (SimpliRoute driver app)."
license: MIT
compatibility: [claude-code, copilot, cursor, codex, opencode]
---

# Mobile E2E Testing — Pipeline & Framework Decisions

## Executive Summary

This document captures all CI/CD decisions made for mobile E2E testing using Maestro on GitHub Actions. It serves as a reference for current and future mobile testing strategies.

---

## 1. CI Pipeline Architecture

### 1.1 Repository Structure

```
agentic-qa-simpliroute/          # QA orchestrator repo
├── .github/workflows/
│   └── e2e-mobile.yml           # Main CI workflow
├── tests/mobile/
│   ├── .maestro/
│   │   └── demo-e2e.yaml        # Maestro test flows
│   └── apk/
│       └── app-release.apk      # Built APK (copied from mobile-demo)
└── mobile-demo/                  # Cloned from mobile-demo repo (git clone)

mobile-demo/                      # App source repo
├── .github/workflows/
│   └── e2e-mobile.yml           # Simpler CI (for direct pushes)
├── App.tsx                       # React Native app
└── .maestro/                     # (optional, for standalone testing)
```

**Key Decision:** QA repo clones `mobile-demo-e2e` (not `mobile-demo`) from GitHub. This allows testing different branches/versions without modifying the app repo.

### 1.2 Workflow Steps (Optimized)

```yaml
1. Checkout QA Repository
2. Clone Mobile Demo Repo (depth 1, specific branch)
3. Restore npm cache
4. Install App Dependencies (npm ci)
5. Restore Android project cache
6. Generate Android Project (if cache miss)
7. Force x86_64 Architecture Only
8. Bundle React Native JS
9. Restore Gradle distribution cache
10. Restore Gradle caches
11. Detect Java path (dynamic)
12. Pre-accept SDK Licenses
13. Build Debug APK
14. Copy APK to Test Location
15. Install Maestro
16. Enable KVM for Emulator
17. Start Emulator & Run Tests (single step)
18. Upload Test Artifacts
19. Save npm cache
20. Save Android project cache
21. Save Gradle distribution cache
22. Save Gradle caches
```

---

## 2. Caching Strategy

### 2.1 What to Cache

| Cache | Path | Size | Key Pattern | Benefit |
|-------|------|------|-------------|---------|
| **npm** | `mobile-demo/node_modules` | ~50MB | `npm-{branch}-{hash(package-lock.json)}` | Skip `npm ci` download |
| **Android project** | `mobile-demo/android` | ~20MB | `android-{branch}-{hash(app.json,package.json,lock)}` | Skip `expo prebuild` |
| **Gradle distribution** | `~/.gradle/wrapper/dists` | ~150MB | `v2-gradle-dist-{OS}-9.3.1` | Skip Gradle download |
| **Gradle caches** | `~/.gradle/caches` | ~300MB | `v2-gradle-caches-{OS}-{hash(gradle files)}` | Skip compilation |

### 2.2 What NOT to Cache

| Item | Size | Why Not |
|------|------|---------|
| **Android SDK** | ~678MB | Too large; `reactivecircus` reinstalls tools anyway |
| **NDK** | ~1.5GB | Too large; installed during Gradle build (~30s) |
| **CMake** | ~50MB | Installed with NDK; not worth separate cache |
| **System images** | ~1.5GB | `reactivecircus` downloads fresh each run |

**Critical Decision:** Use `actions/cache/restore@v4` + manual `actions/cache/save@v4` (NOT `actions/cache@v4`). The old `cache@v4` action saves in the "post" phase, causing 7+ minute delays after tests pass.

### 2.3 Cache Save Best Practices

```yaml
# Use continue-on-error: true to avoid failures when key exists
- name: Save Gradle caches
  if: always()
  continue-on-error: true
  uses: actions/cache/save@v4
  with:
    path: ~/.gradle/caches
    key: v2-gradle-caches-{OS}-{hash}
```

**Why `v2-` prefix?** Old `actions/cache@v4` created entries with different keys. Using `v2-` avoids conflicts.

---

## 3. Android Emulator Configuration

### 3.1 Emulator Settings

```yaml
api-level: 34
target: google_apis
arch: x86_64
profile: pixel_6
```

### 3.2 Known Issues & Fixes

#### Issue 1: Pixel Launcher ANR
**Symptom:** App blocked by ANR dialog on headless emulators.
**Fix:** Disable launcher before tests:
```bash
adb shell pm disable-user com.google.android.apps.nexuslauncher
adb shell pm disable-user com.android.launcher3
adb shell input keyevent KEYCODE_BACK
sleep 2
```

#### Issue 2: Keyboard Covers Buttons
**Symptom:** GBoard keyboard stays open after text input, covering UI elements.
**Fix:** Add `hideKeyboard` step in Maestro flow after text input.

#### Issue 3: FallbackHome After App Launch
**Symptom:** `KEYCODE_BACK` after `sleep 10` dismisses app, shows `FallbackHome`.
**Fix:** Remove unnecessary `KEYCODE_BACK` after app launch. Let Maestro handle app focus.

### 3.3 Emulator Setup Time (~2 min)

The `reactivecircus/android-emulator-runner@v2` action installs SDK components every time:
- build-tools;37.0.0
- platform-tools
- platforms;android-34
- emulator
- system-images;android-34;google_apis;x86_64

**This is unavoidable** without replacing the action entirely. The ~2 min overhead is acceptable for CI.

---

## 4. Maestro Test Design

### 4.1 Test Structure

```yaml
appId: com.anonymous.mobiledemo
---
- launchApp
- extendedWaitUntil:
    visible: Expected Title
    timeout: 30000

# Validate TEXT content, not just visibility
- assertVisible:
    id: main-title
    text: "Exact Expected Text"

# Validate computed values
- tapOn:
    id: increment-button
- assertVisible:
    id: counter-value
    text: "1"
```

### 4.2 Anti-Patterns (What NOT to Do)

```yaml
# BAD: Only checks visibility, not content
- assertVisible:
    id: greeting-text

# GOOD: Validates actual text
- assertVisible:
    id: greeting-text
    text: "Hola Tester!"

# BAD: No value assertion after action
- tapOn:
    id: increment-button
- assertVisible:
    id: counter-value

# GOOD: Validates computed result
- tapOn:
    id: increment-button
- assertVisible:
    id: counter-value
    text: "1"
```

### 4.3 Test Coverage Matrix

| Test | Input | Expected Output |
|------|-------|-----------------|
| Main title | - | "Demo E2E Mobile" |
| Greeting | name="Tester" | "Hola Tester!" |
| Counter initial | - | "0" |
| Increment x3 | 3 taps | "3" |
| Decrement x1 | 1 tap | "2" |
| Decrement x3 (negative) | 3 taps | "-1" |

---

## 5. Framework Comparison

### 5.1 Maestro

**Pros:**
- YAML-based, simple syntax
- Fast setup, low learning curve
- Good for simple apps (demo, MVP)
- Built-in CI support
- No code required for basic flows

**Cons:**
- Limited programmatic control
- No native iOS support (Android only in this setup)
- Weak for complex conditional logic
- No built-in device farm integration
- Limited reporting (JUnit XML only)

**Best for:** Simple apps, prototypes, MVPs, quick validation.

### 5.2 Detox (Wix)

**Pros:**
- JavaScript/TypeScript-based
- Synchronization with React Native
- Better for complex apps
- Integrated with Jest/Mocha
- Gray-box testing (knows app state)
- Better debugging tools

**Cons:**
- Requires app build configuration
- More setup complexity
- React Native specific (not generic)
- Slower than Maestro for simple flows

**Best for:** React Native apps with complex state, gray-box testing.

### 5.3 Appium

**Pros:**
- Industry standard
- Cross-platform (iOS + Android)
- WebDriver protocol
- Extensive ecosystem
- Real device support
- Language agnostic (any WebDriver client)

**Cons:**
- Steep learning curve
- Slower execution
- Flaky without proper waits
- Complex setup (Appium server, drivers)
- More maintenance overhead

**Best for:** Enterprise apps, cross-platform testing, real device testing.

### 5.4 Espresso (Android Native)

**Pros:**
- Native Android testing
- Fast execution
- Access to app internals
- Integrated with Android Studio
- Good for unit/integration tests

**Cons:**
- Android only
- Requires app source code access
- Java/Kotlin required
- Not suitable for E2E across features

**Best for:** Android-native apps, component testing, UI unit tests.

### 5.5 Recommendation Matrix

| App Complexity | Framework | Reason |
|----------------|-----------|--------|
| Simple (demo, MVP) | **Maestro** | Fast setup, YAML, no code |
| Medium (React Native) | **Detox** | Gray-box, synchronization |
| Complex (Enterprise) | **Appium** | Cross-platform, real devices |
| Native Android | **Espresso** | Fast, native integration |

---

## 6. SimpliRoute Driver App — Recommendations

### 6.1 App Features (Expected)

Based on the route-optimizer web demo, the driver app will likely include:

1. **Authentication:** Login/logout, session management
2. **Route Display:** Assigned route, stops, navigation
3. **Visit Management:** Arrive at stop, view details, next stop
4. **Photo Capture:** Take photo, upload, attach to visit
5. **Delivery Confirmation:** Mark delivered/failed, notes
6. **Offline Support:** Queue actions, sync when online
7. **Real-time Updates:** Route changes, notifications

### 6.2 Framework Recommendation: **Detox + Maestro Hybrid**

**Why not just Maestro?**
- Login flow requires session management (Maestro weak here)
- Photo capture needs device camera integration
- Offline/online state transitions need gray-box testing
- Complex state (route progress, visit status) needs app internals

**Why not just Appium?**
- Overkill for React Native app
- Slower execution
- More maintenance overhead

**Recommended approach:**

```
Layer 1: Maestro (Smoke Tests)
├── Login flow (simple)
├── Route display (visibility)
├── Basic navigation
└── Critical path validation

Layer 2: Detox (Integration Tests)
├── Login + session persistence
├── Route progress tracking
├── Photo capture + upload
├── Delivery confirmation flow
├── Offline → Online sync
└── State transitions

Layer 3: Appium (Cross-Platform/E2E)
├── iOS + Android parity
├── Real device testing
├── Performance testing
└── Accessibility testing
```

### 6.3 CI Pipeline for SimpliRoute

```yaml
# Suggested workflow structure
jobs:
  smoke-tests:          # Maestro (fast, ~5 min)
    runs-on: ubuntu-latest
    steps:
      - Maestro smoke tests
    
  integration-tests:    # Detox (medium, ~15 min)
    runs-on: macos-latest  # iOS
    steps:
      - Detox integration tests
    
  e2e-tests:           # Appium (slow, ~30 min)
    strategy:
      matrix:
        device: [android, ios]
    steps:
      - Appium E2E tests
    
  device-farm:         # Real devices (nightly)
    runs-on: ubuntu-latest
    steps:
      - BrowserStack/Sauce Labs
```

### 6.4 Test Data Strategy

```yaml
# For SimpliRoute driver app
Test Data:
  - Driver account: test-driver@simpliroute.com
  - Route: Pre-configured test route with 3 stops
  - Visits: Mock visits with known coordinates
  - Photos: Pre-generated test images
  
Environment Variables:
  - SIMPLIRoute_API_URL
  - TEST_DRIVER_EMAIL
  - TEST_DRIVER_PASSWORD
  - TEST_ROUTE_ID
```

---

## 7. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-19 | Use `cache/restore` + manual `cache/save` | Avoid 7+ min post-job delays |
| 2026-08-19 | Remove NDK/CMake cache | 1.5GB too large, 30s install is acceptable |
| 2026-08-19 | Add `continue-on-error: true` to cache saves | Cache keys may already exist |
| 2026-08-19 | Use `v2-` prefix for cache keys | Avoid conflicts with old `cache@v4` entries |
| 2026-08-19 | Disable Pixel Launcher | Prevents ANR dialog on headless emulators |
| 2026-08-19 | Add `hideKeyboard` after text input | GBoard covers UI elements |
| 2026-08-19 | Remove `KEYCODE_BACK` after app launch | Was dismissing app, showing FallbackHome |
| 2026-08-19 | Add JUnit report output | Parseable test results |
| 2026-08-19 | Validate actual text values in tests | Not just visibility, but content |

---

## 8. Quick Reference

### CI Commands

```bash
# Trigger workflow
gh workflow run 337544211

# Check status
gh run list --repo ahuaracab/agentic-qa-simpliroute --limit=3

# View run details
gh run view <RUN_ID> --repo ahuaracab/agentic-qa-simpliroute

# Download artifacts
gh run download <RUN_ID> --name maestro-test-results --dir ./results

# Cancel stuck run
gh run cancel <RUN_ID> --repo ahuaracab/agentic-qa-simpliroute
```

### Maestro Commands

```bash
# Run tests
maestro test tests/mobile/.maestro/

# Run with JUnit output
maestro test tests/mobile/.maestro/ --format junit --output results.xml

# Run specific flow
maestro test tests/mobile/.maestro/demo-e2e.yaml

# Validate flow (dry run)
maestro validate tests/mobile/.maestro/demo-e2e.yaml
```

### ADB Commands (Debugging)

```bash
# List devices
adb devices

# Install APK
adb install -r path/to/app.apk

# Launch app
adb shell am start -W -n com.anonymous.mobiledemo/.MainActivity

# Take screenshot
adb exec-out screencap -p > screenshot.png

# Dump UI hierarchy
adb shell uiautomator dump /sdcard/dump.xml
adb pull /sdcard/dump.xml .

# Check focused window
adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'

# Disable launcher (prevent ANR)
adb shell pm disable-user com.google.android.apps.nexuslauncher
```

---

## 9. Troubleshooting

### Build fails with "JAVA_HOME invalid"
**Fix:** Remove hardcoded `JAVA_HOME` from env. Use dynamic detection:
```bash
JAVA_PATH=$(dirname $(dirname $(readlink -f $(which java))))
echo "JAVA_HOME=$JAVA_PATH" >> $GITHUB_ENV
```

### Cache save fails
**Fix:** Add `continue-on-error: true` to save steps. Keys may already exist from previous runs.

### Tests pass but post jobs take 7+ min
**Fix:** Switch from `actions/cache@v4` to `actions/cache/restore@v4` + manual `actions/cache/save@v4`.

### App not in focus after launch
**Fix:** Remove `KEYCODE_BACK` after `sleep 10`. Let Maestro handle app focus via `launchApp`.

### Keyboard covers buttons
**Fix:** Add `hideKeyboard` step after text input in Maestro flow.

---

## 10. Future Improvements

1. **iOS Testing:** Add macOS runner + Xcode for iOS simulator
2. **Real Device Testing:** Integrate BrowserStack/Sauce Labs
3. **Performance Testing:** Add frame rate, memory usage metrics
4. **Visual Regression:** Screenshot comparison with Percy/Applitools
5. **Accessibility Testing:** Add axe-core for WCAG validation
6. **Offline Testing:** Simulate network conditions with `adb shell`
7. **Parallel Testing:** Shard tests across multiple emulators
