# Playwright Script Tests

Minimal project for running Playwright scripts only.

## Setup

```powershell
npm install
```

The config launches a host system Chrome, Chromium, or Edge executable. It does not use Playwright-managed browsers.

Override it when needed:

```powershell
$env:HOST_BROWSER_PATH="C:\Path\To\Browser.exe"
```

## Run Tests

Run every test:

```powershell
npm test
```

Run one suite or file:

```powershell
npm run test:suite -- test-scripts/global-search.spec.tsx
```

Run a group by filename pattern:

```powershell
npm run test:suite -- "test-scripts/ai-search-*.spec.tsx"
```

Run with the browser visible:

```powershell
npm run test:headed
```

Run with a trace recorded:

```powershell
npm run test:trace -- test-scripts/global-search.spec.tsx
```

Open the report and view the trace:

```powershell
npm run test:report
```

Open a trace file directly:

```powershell
npm run test:trace:open -- test-results/path-to-trace/trace.zip
```
