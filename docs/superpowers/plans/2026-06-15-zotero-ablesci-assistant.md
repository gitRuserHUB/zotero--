# Zotero AbleSci Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and package a Zotero 9 beta plugin plus a Chrome/Edge Manifest V3 extension that transfers one selected no-PDF item's metadata to AbleSci, fills the request form, and always leaves final submission to the user.

**Architecture:** A shared pure-JavaScript protocol layer owns normalization, validation, Base64URL payloads, merge rules, and redacted diagnostics. The Zotero bundle extracts and validates the selected item, writes a clipboard fallback, opens an AbleSci URL, and registers toolbar/context-menu entry points. The browser bundle consumes the URL fragment into session storage, resumes after login, adapts to the AbleSci DOM, fills/query fields, and renders a status panel without ever locating or clicking a final submit control.

**Tech Stack:** JavaScript ES modules, Node.js 22+, npm, Vitest, jsdom, esbuild, PowerShell-compatible npm scripts, Zotero bootstrap plugin APIs, Chrome/Edge Manifest V3.

---

## File Map

- `package.json`: scripts and development dependencies.
- `vitest.config.js`: Node/jsdom test configuration.
- `scripts/build.mjs`: bundle, stage, and package Zotero XPI plus Chromium ZIP.
- `scripts/verify-artifacts.mjs`: inspect manifests and ZIP contents after build.
- `src/shared/constants.js`: protocol prefix, version, TTL, and field limits.
- `src/shared/metadata.js`: DOI, URL, year, author, and item normalization.
- `src/shared/payload.js`: payload construction, Base64URL encoding, decoding, and validation.
- `src/shared/merge.js`: AbleSci-first field merge and conflict reporting.
- `src/shared/clipboard.js`: readable metadata fallback formatting.
- `src/zotero/item-adapter.js`: convert Zotero item objects to plain metadata and detect PDFs.
- `src/zotero/command.js`: single command workflow independent of Zotero globals.
- `src/zotero/ui.js`: add/remove toolbar and item-context-menu controls per window.
- `src/zotero/plugin.js`: runtime object loaded by bootstrap.
- `src/zotero/bootstrap.js`: Zotero lifecycle functions.
- `src/zotero/manifest.json`: Zotero package metadata and compatibility.
- `src/zotero/icon.svg`: toolbar/menu icon.
- `src/browser/manifest.json`: Chromium Manifest V3 metadata and permissions.
- `src/browser/session-store.js`: service-worker-owned `chrome.storage.session` persistence.
- `src/browser/session-client.js`: content-script message client for pending tasks.
- `src/browser/background.js`: MV3 service worker exposing save/load/clear messages.
- `src/browser/fragment.js`: URL fragment intake and immediate removal.
- `src/browser/selectors.js`: centralized AbleSci field/control candidates.
- `src/browser/dom-adapter.js`: safe unique element lookup, field reads/writes, DOI query wait.
- `src/browser/status-panel.js`: isolated UI for progress, conflicts, copy, and cancel.
- `src/browser/workflow.js`: login recovery and fill orchestration.
- `src/browser/content.js`: content-script entry point.
- `src/browser/status-panel.css`: extension status panel styles.
- `tests/shared/*.test.js`: protocol and merge tests.
- `tests/zotero/*.test.js`: Zotero item, command, and UI adapter tests.
- `tests/browser/*.test.js`: fragment, storage, DOM adapter, panel, and workflow tests.
- `tests/fixtures/ablesci-*.html`: sanitized AbleSci page fixtures with no credentials.
- `README.md`: Chinese installation and usage guide.
- `docs/manual-test-checklist.md`: target-version Zotero/Chrome/Edge acceptance checklist.

## Task 1: Establish the Test and Build Skeleton

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `scripts/build.mjs`
- Create: `scripts/verify-artifacts.mjs`
- Create: `tests/build/artifacts.test.js`

- [ ] **Step 1: Write the failing artifact-layout test**

```js
// tests/build/artifacts.test.js
import { describe, expect, test } from "vitest";
import { expectedArtifactEntries } from "../../scripts/verify-artifacts.mjs";

describe("artifact layout", () => {
  test("declares required Zotero and Chromium files", () => {
    expect(expectedArtifactEntries()).toEqual({
      zotero: expect.arrayContaining(["manifest.json", "bootstrap.js", "ablesci-assistant.js"]),
    chromium: expect.arrayContaining(["manifest.json", "background.js", "content.js", "status-panel.css"]),
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/build/artifacts.test.js`

Expected: FAIL because `package.json` and `scripts/verify-artifacts.mjs` do not exist.

- [ ] **Step 3: Add the package and test configuration**

```json
{
  "name": "zotero-ablesci-assistant",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "node scripts/build.mjs",
    "verify": "npm test && npm run build && node scripts/verify-artifacts.mjs"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.0",
    "esbuild": "^0.27.0",
    "jsdom": "^27.0.0",
    "vitest": "^4.0.0",
    "yazl": "^3.3.1"
  }
}
```

```js
// vitest.config.js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { reporter: ["text", "html"] },
    restoreMocks: true,
  },
});
```

```js
// scripts/verify-artifacts.mjs
import fs from "node:fs/promises";
import path from "node:path";

export function expectedArtifactEntries() {
  return {
    zotero: ["manifest.json", "bootstrap.js", "ablesci-assistant.js", "icon.svg"],
    chromium: ["manifest.json", "background.js", "content.js", "status-panel.css"],
  };
}

export async function verifyStagedArtifacts(root = process.cwd()) {
  for (const [name, entries] of Object.entries(expectedArtifactEntries())) {
    for (const entry of entries) {
      await fs.access(path.join(root, "dist", name, entry));
    }
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  await verifyStagedArtifacts();
  console.log("Artifact verification passed");
}
```

Create `scripts/build.mjs` with exported `buildAll()` that creates `dist/zotero` and `dist/chromium`, runs two esbuild bundles, copies manifests/CSS/icon, and packages `dist/zotero-ablesci-assistant-0.1.0.xpi` plus `dist/ablesci-chromium-extension-0.1.0.zip` with `yazl`. Use `fs.mkdir({ recursive: true })`; never recursively delete directories. Before each build, overwrite known output files individually with `fs.rm(file, { force: true })`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm install && npm test -- tests/build/artifacts.test.js`

Expected: PASS, one test.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json vitest.config.js scripts tests/build
git commit -m "build: establish plugin toolchain"
```

## Task 2: Implement Shared Metadata Normalization and Payload Protocol

**Files:**
- Create: `src/shared/constants.js`
- Create: `src/shared/metadata.js`
- Create: `src/shared/payload.js`
- Create: `src/shared/clipboard.js`
- Create: `tests/shared/metadata.test.js`
- Create: `tests/shared/payload.test.js`
- Create: `tests/shared/clipboard.test.js`

- [ ] **Step 1: Write failing normalization tests**

```js
// tests/shared/metadata.test.js
import { describe, expect, test } from "vitest";
import { normalizeDoi, normalizeMetadata, normalizeUrl } from "../../src/shared/metadata.js";

describe("metadata normalization", () => {
  test.each([
    ["doi: 10.1000/ABC.1", "10.1000/abc.1"],
    ["https://doi.org/10.1016/j.test.2026.01.001", "10.1016/j.test.2026.01.001"],
    ["not-a-doi", ""],
  ])("normalizes DOI %s", (input, expected) => {
    expect(normalizeDoi(input)).toBe(expected);
  });

  test("allows only http and https URLs", () => {
    expect(normalizeUrl("https://publisher.example/paper")).toBe("https://publisher.example/paper");
    expect(normalizeUrl("javascript:alert(1)")).toBe("");
  });

  test("requires a title and bounds every string", () => {
    expect(() => normalizeMetadata({ title: "   " })).toThrow("TITLE_REQUIRED");
    const item = normalizeMetadata({ title: `  Paper  `, year: "2026-05-01" });
    expect(item.title).toBe("Paper");
    expect(item.year).toBe("2026");
  });
});
```

```js
// tests/shared/payload.test.js
import { describe, expect, test } from "vitest";
import { buildPayload, decodeFragment, encodeFragment } from "../../src/shared/payload.js";

describe("payload protocol", () => {
  test("round-trips a versioned payload", () => {
    const now = 1_781_530_000_000;
    const payload = buildPayload({ title: "Paper" }, { now, nonce: "n-1" });
    expect(decodeFragment(encodeFragment(payload), { now })).toEqual(payload);
  });

  test("rejects expired payloads", () => {
    const payload = buildPayload({ title: "Paper" }, { now: 1000, nonce: "n-1" });
    expect(() => decodeFragment(encodeFragment(payload), { now: 1000 + 30 * 60 * 1000 + 1 }))
      .toThrow("PAYLOAD_EXPIRED");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/shared`

Expected: FAIL with missing shared modules.

- [ ] **Step 3: Implement constants and normalization**

```js
// src/shared/constants.js
export const PROTOCOL_VERSION = 1;
export const FRAGMENT_PREFIX = "#zotero-ablesci=";
export const PAYLOAD_TTL_MS = 30 * 60 * 1000;
export const MAX_LENGTHS = Object.freeze({
  title: 1000,
  doi: 300,
  author: 300,
  publicationTitle: 500,
  year: 4,
  url: 2000,
  zoteroKey: 32,
  itemType: 64,
});
```

```js
// src/shared/metadata.js
import { MAX_LENGTHS } from "./constants.js";

function bounded(value, limit) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);
}

export function normalizeDoi(value) {
  const doi = bounded(value, MAX_LENGTHS.doi)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : "";
}

export function normalizeUrl(value) {
  const raw = bounded(value, MAX_LENGTHS.url);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeYear(value) {
  return bounded(value, 32).match(/\b(18|19|20|21)\d{2}\b/)?.[0] ?? "";
}

export function normalizeMetadata(input) {
  const title = bounded(input.title, MAX_LENGTHS.title);
  if (!title) throw new Error("TITLE_REQUIRED");
  return {
    zoteroKey: bounded(input.zoteroKey, MAX_LENGTHS.zoteroKey),
    itemType: bounded(input.itemType, MAX_LENGTHS.itemType),
    title,
    doi: normalizeDoi(input.doi),
    authors: (input.authors ?? []).map((v) => bounded(v, MAX_LENGTHS.author)).filter(Boolean).slice(0, 100),
    publicationTitle: bounded(input.publicationTitle, MAX_LENGTHS.publicationTitle),
    year: normalizeYear(input.year),
    url: normalizeUrl(input.url),
  };
}
```

Implement `payload.js` with UTF-8 Base64URL helpers that work with either `Buffer` or `TextEncoder`/`btoa`, exact prefix checking, object-shape validation, version checking, TTL checking, and normalized metadata reconstruction. Implement `clipboard.js` as `formatMetadataText(item)` producing labeled Chinese lines for title, DOI, authors, journal, year, and official URL while omitting empty values.

- [ ] **Step 4: Run shared tests and verify GREEN**

Run: `npm test -- tests/shared`

Expected: PASS for normalization, protocol, expiry, malformed input, and clipboard formatting.

- [ ] **Step 5: Commit**

```powershell
git add src/shared tests/shared
git commit -m "feat: add metadata payload protocol"
```

## Task 3: Implement AbleSci-First Merge and Conflict Rules

**Files:**
- Create: `src/shared/merge.js`
- Create: `tests/shared/merge.test.js`

- [ ] **Step 1: Write failing merge tests**

```js
// tests/shared/merge.test.js
import { describe, expect, test } from "vitest";
import { mergeFormValues } from "../../src/shared/merge.js";

describe("AbleSci-first merge", () => {
  test("keeps non-empty site values and fills empty fields", () => {
    const result = mergeFormValues(
      { title: "Site title", doi: "10.1000/site", publicationTitle: "" },
      { title: "Zotero title", doi: "10.1000/zotero", publicationTitle: "Journal" },
    );
    expect(result.values).toEqual({
      title: "Site title",
      doi: "10.1000/site",
      publicationTitle: "Journal",
    });
    expect(result.conflicts.map((c) => c.field)).toEqual(["title", "doi"]);
  });

  test("compares DOI case-insensitively", () => {
    expect(mergeFormValues({ doi: "10.1000/ABC" }, { doi: "10.1000/abc" }).conflicts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/shared/merge.test.js`

Expected: FAIL because `merge.js` is missing.

- [ ] **Step 3: Implement deterministic merge**

```js
// src/shared/merge.js
const FIELDS = ["title", "doi", "authors", "publicationTitle", "year", "url"];

function comparable(field, value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  const normalized = text.trim().replace(/\s+/g, " ");
  return field === "doi" ? normalized.toLowerCase() : normalized;
}

export function mergeFormValues(siteValues, zoteroValues) {
  const values = {};
  const conflicts = [];
  for (const field of FIELDS) {
    const site = siteValues[field] ?? "";
    const zotero = zoteroValues[field] ?? "";
    values[field] = comparable(field, site) ? site : zotero;
    if (comparable(field, site) && comparable(field, zotero)
      && comparable(field, site) !== comparable(field, zotero)) {
      conflicts.push({ field, site, zotero });
    }
  }
  return { values, conflicts };
}
```

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/shared/merge.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/merge.js tests/shared/merge.test.js
git commit -m "feat: preserve AbleSci values during merge"
```

## Task 4: Build Zotero Item Extraction and PDF Validation

**Files:**
- Create: `src/zotero/item-adapter.js`
- Create: `tests/zotero/item-adapter.test.js`

- [ ] **Step 1: Write failing item-adapter tests with plain fakes**

```js
// tests/zotero/item-adapter.test.js
import { describe, expect, test } from "vitest";
import { extractMetadata, hasPdfAttachment, validateSelection } from "../../src/zotero/item-adapter.js";

const item = (fields = {}, extra = {}) => ({
  key: "ABCD1234",
  itemType: "journalArticle",
  isRegularItem: () => true,
  getField: (name) => fields[name] ?? "",
  getCreators: () => [{ firstName: "Ada", lastName: "Lovelace", creatorType: "author" }],
  getAttachments: () => [],
  ...extra,
});

describe("Zotero item adapter", () => {
  test("rejects zero, multiple, and non-regular selections", () => {
    expect(() => validateSelection([])).toThrow("NO_SELECTION");
    expect(() => validateSelection([item(), item()])).toThrow("MULTIPLE_SELECTION");
    expect(() => validateSelection([item({}, { isRegularItem: () => false })])).toThrow("REGULAR_ITEM_REQUIRED");
  });

  test("extracts supported fields", () => {
    expect(extractMetadata(item({
      title: "Paper",
      DOI: "10.1000/Test",
      publicationTitle: "Journal",
      date: "2026-04-10",
      url: "https://publisher.example/paper",
    }))).toMatchObject({
      title: "Paper",
      doi: "10.1000/test",
      authors: ["Lovelace, Ada"],
      publicationTitle: "Journal",
      year: "2026",
    });
  });

  test("detects stored and linked PDF children", async () => {
    const getByID = (id) => ({
      1: { attachmentContentType: "application/pdf", getField: () => "" },
      2: { attachmentContentType: "", getField: (name) => name === "url" ? "https://x/paper.pdf" : "" },
    }[id]);
    expect(await hasPdfAttachment(item({}, { getAttachments: () => [1] }), { getByID })).toBe(true);
    expect(await hasPdfAttachment(item({}, { getAttachments: () => [2] }), { getByID })).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/zotero/item-adapter.test.js`

Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement the adapter**

Implement these exports exactly, then add focused cases for institutional creators and missing child attachments:

```js
import { normalizeMetadata } from "../shared/metadata.js";

export function validateSelection(items) {
  if (!items?.length) throw new Error("NO_SELECTION");
  if (items.length !== 1) throw new Error("MULTIPLE_SELECTION");
  if (!items[0].isRegularItem?.()) throw new Error("REGULAR_ITEM_REQUIRED");
  return items[0];
}

function creatorName(creator) {
  if (creator.name) return creator.name;
  return [creator.lastName, creator.firstName].filter(Boolean).join(", ");
}

export function extractMetadata(item) {
  return normalizeMetadata({
    zoteroKey: item.key,
    itemType: item.itemType,
    title: item.getField("title"),
    doi: item.getField("DOI"),
    authors: item.getCreators().filter((c) => c.creatorType === "author").map(creatorName),
    publicationTitle: item.getField("publicationTitle")
      || item.getField("bookTitle")
      || item.getField("proceedingsTitle"),
    year: item.getField("date"),
    url: item.getField("url"),
  });
}

function looksLikePdf(attachment) {
  if (attachment.attachmentContentType?.toLowerCase() === "application/pdf") return true;
  const values = [
    attachment.getField?.("url"),
    attachment.getField?.("path"),
    attachment.attachmentFilename,
  ];
  return values.some((value) => String(value ?? "").split(/[?#]/, 1)[0].toLowerCase().endsWith(".pdf"));
}

export async function hasPdfAttachment(item, { getByID }) {
  for (const id of item.getAttachments()) {
    const attachment = await getByID(id);
    if (attachment && looksLikePdf(attachment)) return true;
  }
  return false;
}
```

Use `title`, `DOI`, `publicationTitle`, fallback `bookTitle`/`proceedingsTitle`, `date`, and `url`. Format creators as `Last, First`; use `name` for institutional creators. PDF detection returns true for `attachmentContentType === "application/pdf"`, a `.pdf` attachment URL after removing query/hash, or an attachment filename/path ending in `.pdf`. It does not require the local file to exist.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/zotero/item-adapter.test.js`

Expected: PASS, including no-attachment and missing-child cases.

- [ ] **Step 5: Commit**

```powershell
git add src/zotero/item-adapter.js tests/zotero/item-adapter.test.js
git commit -m "feat: validate Zotero items and PDF attachments"
```

## Task 5: Implement the Zotero Command Workflow

**Files:**
- Create: `src/zotero/command.js`
- Create: `tests/zotero/command.test.js`

- [ ] **Step 1: Write failing command tests**

```js
// tests/zotero/command.test.js
import { describe, expect, test, vi } from "vitest";
import { createRequestCommand } from "../../src/zotero/command.js";

describe("Zotero request command", () => {
  test("copies fallback text, opens AbleSci, and reports success", async () => {
    const deps = {
      getSelectedItems: () => [{ key: "ABCD1234" }],
      validateSelection: (items) => items[0],
      hasPdfAttachment: async () => false,
      extractMetadata: () => ({ title: "Paper", doi: "10.1000/paper", authors: [] }),
      buildPayload: (item) => ({ v: 1, createdAt: 1, nonce: "n", item }),
      encodeFragment: () => "#zotero-ablesci=encoded",
      formatMetadataText: () => "标题：Paper",
      writeClipboard: vi.fn(),
      openUrl: vi.fn(),
      notify: vi.fn(),
      now: () => 1,
      nonce: () => "n",
    };
    await createRequestCommand(deps)();
    expect(deps.writeClipboard).toHaveBeenCalledWith("标题：Paper");
    expect(deps.openUrl).toHaveBeenCalledWith("https://www.ablesci.com/assist/create#zotero-ablesci=encoded");
    expect(deps.notify).toHaveBeenCalledWith("success", "已打开科研通，请核对后发布");
  });

  test("blocks an item that already has a PDF", async () => {
    const notify = vi.fn();
    const command = createRequestCommand({
      getSelectedItems: () => [{}], validateSelection: (x) => x[0],
      hasPdfAttachment: async () => true, notify,
    });
    await command();
    expect(notify).toHaveBeenCalledWith("warning", "该文献已有 PDF，无需发起求助");
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/zotero/command.test.js`

Expected: FAIL because `command.js` is missing.

- [ ] **Step 3: Implement dependency-injected command handling**

`createRequestCommand(deps)` must catch stable adapter/protocol codes and map them to these exact Chinese messages:

```js
const MESSAGES = {
  NO_SELECTION: "请先选择一篇文献",
  MULTIPLE_SELECTION: "首版仅支持一次求助一篇文献",
  REGULAR_ITEM_REQUIRED: "请选择普通文献条目，而不是附件、笔记或批注",
  TITLE_REQUIRED: "该条目缺少标题，请先在 Zotero 中补充",
};
```

For an eligible item, build a payload with injected clock/nonce, write clipboard text first, then open the URL. If opening fails, show an error that explicitly says metadata remains on the clipboard.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/zotero/command.test.js`

Expected: PASS for success, PDF block, validation messages, and open failure.

- [ ] **Step 5: Commit**

```powershell
git add src/zotero/command.js tests/zotero/command.test.js
git commit -m "feat: add Zotero request command"
```

## Task 6: Integrate Zotero Lifecycle, Toolbar, and Context Menu

**Files:**
- Create: `src/zotero/ui.js`
- Create: `src/zotero/plugin.js`
- Create: `src/zotero/bootstrap.js`
- Create: `src/zotero/manifest.json`
- Create: `src/zotero/icon.svg`
- Create: `tests/zotero/ui.test.js`
- Create: `tests/zotero/plugin.test.js`

- [ ] **Step 1: Write failing DOM fixture tests for add/remove symmetry**

```js
// tests/zotero/ui.test.js
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { addWindowUi, removeWindowUi } from "../../src/zotero/ui.js";

describe("Zotero window UI", () => {
  test("adds both entry points and removes them", () => {
    document.body.innerHTML = `
      <div id="zotero-items-toolbar"></div>
      <div id="zotero-itemmenu"></div>`;
    const onCommand = vi.fn();
    addWindowUi({ document }, { onCommand, iconUrl: "icon.svg" });
    document.querySelector("#ablesci-toolbar-button").click();
    document.querySelector("#ablesci-item-menu").click();
    expect(onCommand).toHaveBeenCalledTimes(2);
    removeWindowUi({ document });
    expect(document.querySelector("#ablesci-toolbar-button")).toBeNull();
    expect(document.querySelector("#ablesci-item-menu")).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/zotero/ui.test.js tests/zotero/plugin.test.js`

Expected: FAIL because Zotero UI/lifecycle modules are missing.

- [ ] **Step 3: Implement UI and lifecycle**

`ui.js` must create uniquely identified XUL/HTML-compatible controls using `document.createXULElement?.(...) ?? document.createElement(...)`. Resolve toolbar host from `#zotero-items-toolbar`, then `#zotero-tb` as a target-version fallback. Resolve context menu from `#zotero-itemmenu`. Throw `ZOTERO_UI_HOST_NOT_FOUND` rather than inserting controls elsewhere. Store no global DOM references; remove by fixed IDs.

`plugin.js` must export a runtime with `init`, `addToWindow`, `addToAllWindows`, `removeFromWindow`, and `removeFromAllWindows`. Construct command dependencies from `window.ZoteroPane.getSelectedItems()`, `Zotero.Items.getAsync(id)`, `Zotero.Utilities.Internal.copyTextToClipboard(text)`, `Zotero.launchURL(url)`, and a `Zotero.ProgressWindow` notifier.

`bootstrap.js` must follow the official bootstrapped lifecycle pattern:

```js
var AbleSciAssistant;

async function startup({ id, version, rootURI }) {
  Services.scriptloader.loadSubScript(rootURI + "ablesci-assistant.js");
  AbleSciAssistant.init({ id, version, rootURI });
  AbleSciAssistant.addToAllWindows();
}

function onMainWindowLoad({ window }) {
  AbleSciAssistant.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  AbleSciAssistant.removeFromWindow(window);
}

function shutdown() {
  AbleSciAssistant?.removeFromAllWindows();
  AbleSciAssistant = undefined;
}

function install() {}
function uninstall() {}
```

`manifest.json` must use plugin ID `zotero-ablesci-assistant@local`, version `0.1.0`, `manifest_version: 2`, `strict_min_version: "9.0-beta.21"`, and `strict_max_version: "9.0.*"`. During target-version verification, narrow the maximum if Zotero reports incompatibility.

- [ ] **Step 4: Run tests and build the Zotero stage**

Run: `npm test -- tests/zotero && npm run build`

Expected: tests PASS; `dist/zotero/manifest.json`, `bootstrap.js`, `ablesci-assistant.js`, and `icon.svg` exist.

- [ ] **Step 5: Perform the first target-version UI probe**

Install the staged plugin from source in a dedicated Zotero test profile. Start Zotero `9.0-beta.21+1a89239a1` with debug output. Confirm actual toolbar/menu host IDs. If either target differs, update only `src/zotero/ui.js` and its fixture test, rerun tests, and record the observed IDs in `docs/manual-test-checklist.md`.

- [ ] **Step 6: Commit**

```powershell
git add src/zotero tests/zotero scripts/build.mjs
git commit -m "feat: integrate Zotero 9 user interface"
```

## Task 7: Implement Browser Fragment Intake and Session Persistence

**Files:**
- Create: `src/browser/manifest.json`
- Create: `src/browser/fragment.js`
- Create: `src/browser/session-store.js`
- Create: `src/browser/session-client.js`
- Create: `src/browser/background.js`
- Create: `tests/browser/fragment.test.js`
- Create: `tests/browser/session-store.test.js`

- [ ] **Step 1: Write failing fragment and storage tests**

```js
// tests/browser/fragment.test.js
// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { consumeFragment } from "../../src/browser/fragment.js";

test("decodes and immediately removes the URL fragment", () => {
  history.replaceState({}, "", "/assist/create#zotero-ablesci=encoded");
  const replaceState = vi.spyOn(history, "replaceState");
  const payload = consumeFragment({ decode: () => ({ v: 1, item: { title: "Paper" } }) });
  expect(payload.item.title).toBe("Paper");
  expect(replaceState).toHaveBeenCalled();
  expect(location.hash).toBe("");
});
```

```js
// tests/browser/session-store.test.js
import { expect, test } from "vitest";
import { createSessionStore } from "../../src/browser/session-store.js";

test("stores, retrieves, and clears the pending task", async () => {
  const data = {};
  const area = {
    set: async (value) => Object.assign(data, value),
    get: async (key) => ({ [key]: data[key] }),
    remove: async (key) => delete data[key],
  };
  const store = createSessionStore(area);
  await store.save({ nonce: "n-1" });
  expect(await store.load()).toEqual({ nonce: "n-1" });
  await store.clear();
  expect(await store.load()).toBeNull();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/browser/fragment.test.js tests/browser/session-store.test.js`

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement the browser intake layer**

`consumeFragment({ decode, locationObject = location, historyObject = history })` must return null when the prefix is absent. When present, call `history.replaceState` in a `finally` block so malformed or expired payloads are also removed.

`createSessionStore(storageArea, key = "ablesciPendingTask")` must expose `save`, `load`, and `clear`. `background.js` constructs it with `chrome.storage.session` and handles only these messages: `ABLESCI_TASK_SAVE`, `ABLESCI_TASK_LOAD`, and `ABLESCI_TASK_CLEAR`. It returns `{ ok: true, value }` or `{ ok: false, error }` and never logs task metadata.

`createSessionClient(sendMessage = chrome.runtime.sendMessage)` must expose the same three methods and translate failed responses into `SESSION_STORE_FAILED`. Content scripts use this client rather than direct storage access, because MV3 session storage is service-worker-owned and need not be exposed to untrusted contexts.

Use this minimal manifest:

```json
{
  "manifest_version": 3,
  "name": "Zotero 科研通文献求助助手",
  "version": "0.1.0",
  "description": "接收 Zotero 文献元数据并辅助填写科研通求助表单",
  "permissions": ["storage", "clipboardWrite"],
  "host_permissions": ["https://www.ablesci.com/*", "http://www.ablesci.com/*"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["https://www.ablesci.com/*", "http://www.ablesci.com/*"],
    "js": ["content.js"],
    "css": ["status-panel.css"],
    "run_at": "document_idle"
  }]
}
```

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/browser/fragment.test.js tests/browser/session-store.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/browser/manifest.json src/browser/fragment.js src/browser/session-store.js tests/browser
git commit -m "feat: persist browser handoff tasks"
```

## Task 8: Implement the AbleSci DOM Adapter and DOI Query

**Files:**
- Create: `src/browser/selectors.js`
- Create: `src/browser/dom-adapter.js`
- Create: `tests/fixtures/ablesci-create.html`
- Create: `tests/fixtures/ablesci-login.html`
- Create: `tests/browser/dom-adapter.test.js`

- [ ] **Step 1: Create sanitized fixtures and failing adapter tests**

The create fixture must include labeled fields for DOI, title, author, journal, year, URL, a button named `查询`, and a separate final button named `发布求助`. The login fixture must include a password input and no request form.

```js
// tests/browser/dom-adapter.test.js
// @vitest-environment jsdom
import fs from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAbleSciAdapter } from "../../src/browser/dom-adapter.js";

describe("AbleSci DOM adapter", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = fs.readFileSync("tests/fixtures/ablesci-create.html", "utf8");
  });

  test("fills DOI and clicks only the query control", async () => {
    const query = document.querySelector('[data-testid="doi-query"]');
    const publish = document.querySelector('[data-testid="publish"]');
    vi.spyOn(query, "click");
    vi.spyOn(publish, "click");
    const adapter = createAbleSciAdapter(document);
    await adapter.queryDoi("10.1000/paper", { timeoutMs: 20 });
    expect(query.click).toHaveBeenCalledOnce();
    expect(publish.click).not.toHaveBeenCalled();
  });

  test("throws when a critical selector is ambiguous", () => {
    document.body.insertAdjacentHTML("beforeend", '<input name="doi">');
    expect(() => createAbleSciAdapter(document).readValues()).toThrow("AMBIGUOUS_FIELD:doi");
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/browser/dom-adapter.test.js`

Expected: FAIL because selectors and adapter are missing.

- [ ] **Step 3: Implement centralized selectors and strict lookup**

```js
// src/browser/selectors.js
export const FIELD_SELECTORS = Object.freeze({
  doi: ['input[name="doi"]', 'input[id*="doi" i]', 'input[placeholder*="DOI" i]'],
  title: ['input[name="title"]', 'textarea[name="title"]', 'input[placeholder*="标题"]'],
  authors: ['input[name="author"]', 'input[name="authors"]', 'input[placeholder*="作者"]'],
  publicationTitle: ['input[name="journal"]', 'input[name="publication"]', 'input[placeholder*="期刊"]'],
  year: ['input[name="year"]', 'input[placeholder*="年份"]'],
  url: ['input[name="url"]', 'input[name="link"]', 'input[placeholder*="网址"]'],
});

export const QUERY_SELECTORS = [
  '[data-testid="doi-query"]',
  'button[name="doi-query"]',
  'button[type="button"]',
];
```

`dom-adapter.js` must:

- Resolve each field by trying selectors in order and requiring exactly one visible match for the first matching selector.
- Resolve the DOI query control by exact trimmed visible text `查询` or explicit test/name attributes.
- Never search for, cache, or expose a publish/submit control.
- Dispatch `input` and `change` after writing.
- Expose `isLoginPage`, `isCreatePage`, `readValues`, `writeEmptyFields`, and `queryDoi`.
- Implement DOI completion using `MutationObserver`: resolve when non-DOI fields change, reject when an explicit error node appears, and timeout with `DOI_QUERY_TIMEOUT`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/browser/dom-adapter.test.js`

Expected: PASS, including the assertion that the final publish button is untouched.

- [ ] **Step 5: Inspect the authenticated page and update only selectors/fixtures**

With the user's test account already logged in, open `https://www.ablesci.com/assist/create`, inspect the actual labels, `name`/`id` attributes, query button, success/error state, and login redirect URL. Do not inspect cookies or password fields. Replace fixture attributes and selector candidates only where the real DOM differs. Preserve strict uniqueness and rerun the adapter tests.

- [ ] **Step 6: Commit**

```powershell
git add src/browser/selectors.js src/browser/dom-adapter.js tests/fixtures tests/browser/dom-adapter.test.js
git commit -m "feat: adapt to AbleSci request form"
```

## Task 9: Add the Status Panel and User-Controlled Recovery

**Files:**
- Create: `src/browser/status-panel.js`
- Create: `src/browser/status-panel.css`
- Create: `tests/browser/status-panel.test.js`

- [ ] **Step 1: Write failing status-panel tests**

```js
// tests/browser/status-panel.test.js
// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { createStatusPanel } from "../../src/browser/status-panel.js";

test("shows conflicts and exposes copy/cancel without publish", async () => {
  const copy = vi.fn();
  const cancel = vi.fn();
  const panel = createStatusPanel(document, { copy, cancel });
  panel.showReady([{ field: "title", site: "Site", zotero: "Zotero" }]);
  expect(panel.root.textContent).toContain("已自动填充，请核对后发布");
  expect(panel.root.textContent).toContain("标题存在差异");
  expect(panel.root.textContent).not.toContain("自动发布");
  panel.root.querySelector('[data-action="copy"]').click();
  panel.root.querySelector('[data-action="cancel"]').click();
  expect(copy).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/browser/status-panel.test.js`

Expected: FAIL because panel files are missing.

- [ ] **Step 3: Implement an isolated fixed panel**

Create a root element `#zotero-ablesci-status` with `role="status"`, stage text, conflict list, `复制全部元数据`, and `取消本次填充` buttons. Expose `showReading`, `showLoginRequired`, `showQuerying`, `showReady`, `showWarning`, `showError`, and `destroy`. Map internal fields to Chinese labels. Style it at the top-right with a high z-index, max width 380px, yellow warning and red error variants, without covering the center form.

The copy callback must call `navigator.clipboard.writeText(formatMetadataText(item))`; if clipboard permission fails, change the status text to instruct manual copy from a readonly textarea rendered inside the panel.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/browser/status-panel.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/browser/status-panel.js src/browser/status-panel.css tests/browser/status-panel.test.js
git commit -m "feat: add AbleSci fill status panel"
```

## Task 10: Orchestrate Login Recovery, DOI Query, and Manual Fill

**Files:**
- Create: `src/browser/workflow.js`
- Create: `src/browser/content.js`
- Create: `tests/browser/workflow.test.js`

- [ ] **Step 1: Write failing workflow tests**

```js
// tests/browser/workflow.test.js
import { describe, expect, test, vi } from "vitest";
import { runWorkflow } from "../../src/browser/workflow.js";

const task = { item: {
  title: "Zotero title", doi: "10.1000/paper", authors: ["Lovelace, Ada"],
  publicationTitle: "Journal", year: "2026", url: "https://publisher.example/paper",
} };

describe("browser workflow", () => {
  test("keeps a pending task on the login page", async () => {
    const store = { save: vi.fn(), clear: vi.fn() };
    const panel = { showLoginRequired: vi.fn() };
    await runWorkflow({ task, store, panel, adapter: { isLoginPage: () => true } });
    expect(store.save).toHaveBeenCalledWith(task);
    expect(store.clear).not.toHaveBeenCalled();
    expect(panel.showLoginRequired).toHaveBeenCalledOnce();
  });

  test("queries DOI, preserves site values, fills blanks, and clears task", async () => {
    const adapter = {
      isLoginPage: () => false,
      isCreatePage: () => true,
      queryDoi: vi.fn(),
      readValues: vi.fn().mockReturnValue({ title: "Site title", doi: "10.1000/paper", publicationTitle: "" }),
      writeEmptyFields: vi.fn(),
    };
    const store = { save: vi.fn(), clear: vi.fn() };
    const panel = { showQuerying: vi.fn(), showReady: vi.fn(), showWarning: vi.fn() };
    await runWorkflow({ task, store, panel, adapter });
    expect(adapter.queryDoi).toHaveBeenCalledWith("10.1000/paper", expect.any(Object));
    expect(adapter.writeEmptyFields).toHaveBeenCalledWith(expect.objectContaining({ publicationTitle: "Journal" }));
    expect(store.clear).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/browser/workflow.test.js`

Expected: FAIL because workflow/content entry files are missing.

- [ ] **Step 3: Implement orchestration**

`runWorkflow` behavior:

1. If login page, save task and show login guidance; do not navigate or touch credentials.
2. If not create page, save task and set `location.href` to `/assist/create` only when same-origin.
3. On create page, query DOI when present.
4. On explicit query failure/timeout, show warning and continue to manual field fill.
5. Read site values, call `mergeFormValues`, and pass only merged values to `writeEmptyFields`.
6. Add a no-DOI warning when both DOI and official URL are empty.
7. Show conflicts, clear the stored task after filling, and leave the form open.
8. On selector ambiguity or missing critical fields, stop and show error plus copy recovery.

`content.js` must construct `createSessionClient()`, consume a new fragment and save it, otherwise load an existing task, create the panel/adapter, wire cancel to `store.clear()` plus `panel.destroy()`, and invoke `runWorkflow`. It must not contain the strings `发布求助` as a selector, `form.submit`, `requestSubmit`, or a click against a submit control.

- [ ] **Step 4: Add a static no-submit regression test**

Extend `workflow.test.js` to read `src/browser/content.js`, `workflow.js`, and `dom-adapter.js` and reject `requestSubmit`, `.submit(`, `[type="submit"]`, or a selector built from `发布求助`.

- [ ] **Step 5: Run browser tests and verify GREEN**

Run: `npm test -- tests/browser`

Expected: PASS for login, DOI success/failure, no DOI, conflict, selector failure, cancel, and no-submit regression cases.

- [ ] **Step 6: Commit**

```powershell
git add src/browser/workflow.js src/browser/content.js tests/browser/workflow.test.js
git commit -m "feat: orchestrate safe AbleSci form filling"
```

## Task 11: Complete Packaging, Documentation, and Artifact Verification

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `scripts/verify-artifacts.mjs`
- Create: `README.md`
- Create: `docs/manual-test-checklist.md`
- Modify: `.gitignore`
- Modify: `tests/build/artifacts.test.js`

- [ ] **Step 1: Extend failing artifact tests**

Add assertions that:

- Zotero manifest version equals package version.
- Zotero archive has no enclosing directory and contains `manifest.json` at archive root.
- Chromium manifest is MV3 and host permissions contain only AbleSci HTTP/HTTPS origins.
- Browser bundle does not contain `requestSubmit`, `.submit(`, telemetry hosts, or non-AbleSci host permissions.
- Both archives are non-empty and can be enumerated by `yauzl` or a small ZIP reader added as a development dependency.

Run: `npm test -- tests/build/artifacts.test.js`

Expected: FAIL until packaging verification is complete.

- [ ] **Step 2: Finish deterministic packaging**

Update `build.mjs` to:

1. Overwrite only known files under `dist`; never recursively delete.
2. Bundle `src/zotero/plugin.js` as IIFE global `AbleSciAssistantBundle` and append `var AbleSciAssistant = AbleSciAssistantBundle.AbleSciAssistant;` so the bootstrap lifecycle sees the runtime directly.
3. Copy `src/zotero/bootstrap.js`, manifest, and icon.
4. Bundle `src/browser/background.js` and `src/browser/content.js` as separate IIFEs.
5. Copy browser manifest and CSS.
6. Create XPI/ZIP with normalized forward-slash paths and fixed file order.
7. Print absolute artifact paths and byte sizes.

- [ ] **Step 3: Write the Chinese user documentation**

`README.md` must include:

- Supported Zotero version and beta compatibility warning.
- Zotero `.xpi` installation steps.
- Chrome `chrome://extensions` and Edge `edge://extensions` developer-mode installation steps.
- One-item workflow and all block messages.
- Login recovery behavior.
- Meaning of yellow field differences.
- Explicit statement that final publication is always manual.
- Extension-missing clipboard fallback.
- Troubleshooting for page changes and how to provide sanitized DOM details without credentials.
- Uninstallation steps for both components.

`docs/manual-test-checklist.md` must list exact pass/fail boxes for the eight design acceptance scenarios, target app versions, actual UI host IDs, AbleSci selector observations, artifact hashes, and a final check that no automatic publication occurred.

- [ ] **Step 4: Build and verify all artifacts**

Run: `npm run verify`

Expected:

```text
All test files passed
Built: ...\dist\zotero-ablesci-assistant-0.1.0.xpi
Built: ...\dist\ablesci-chromium-extension-0.1.0.zip
Artifact verification passed
```

- [ ] **Step 5: Commit**

```powershell
git add scripts package.json package-lock.json README.md docs/manual-test-checklist.md tests/build .gitignore
git commit -m "docs: package and document AbleSci assistant"
```

## Task 12: Perform Target-Version End-to-End Acceptance

**Files:**
- Modify: `docs/manual-test-checklist.md`
- Modify only if verification exposes a defect: relevant source and test file

- [ ] **Step 1: Verify the Zotero XPI lifecycle**

Using a dedicated Zotero profile on `9.0-beta.21+1a89239a1` 64-bit:

1. Install the generated XPI.
2. Restart Zotero and confirm both entry points remain.
3. Test no selection, multi-selection, note/attachment selection, title missing, stored PDF, linked PDF, and eligible no-PDF item.
4. Disable/uninstall and confirm controls are removed without restart residue.

Record exact results and sanitized debug errors in the checklist.

- [ ] **Step 2: Verify Chrome and Edge separately**

Load `dist/chromium` unpacked in each browser. For each browser, verify:

1. Logged-out handoff survives login within the same browser session.
2. DOI success fills blanks and preserves AbleSci values.
3. DOI conflict produces yellow comparison details.
4. DOI failure falls back to manual fields.
5. No DOI with URL fills the available fields.
6. No DOI and no URL displays a warning.
7. Cancel removes the pending task.
8. Closing the browser session removes the pending task.
9. The final publish button is never clicked automatically.

- [ ] **Step 3: Verify the no-extension fallback**

Disable the browser extension, trigger the Zotero command, and confirm AbleSci opens with the payload fragment untouched while the complete readable metadata is available on the clipboard for manual use. Re-enable the extension afterward.

- [ ] **Step 4: Fix defects using TDD**

For each defect, add a focused failing regression test, run it to verify RED, implement the smallest fix, rerun focused and full suites, and record the result. Do not patch production behavior without a reproducing test.

- [ ] **Step 5: Run final verification and capture hashes**

Run:

```powershell
npm run verify
Get-FileHash -Algorithm SHA256 .\dist\zotero-ablesci-assistant-0.1.0.xpi
Get-FileHash -Algorithm SHA256 .\dist\ablesci-chromium-extension-0.1.0.zip
git status --short
```

Expected: all tests and artifact checks pass; both hashes are recorded in `docs/manual-test-checklist.md`; only the checklist is modified before the final acceptance commit.

- [ ] **Step 6: Commit acceptance evidence**

```powershell
git add docs/manual-test-checklist.md
git commit -m "test: record target-version acceptance"
```

## Completion Conditions

- Automated tests pass from a clean dependency install.
- The build produces a root-valid Zotero XPI and loadable Chromium extension directory/ZIP.
- Zotero `9.0-beta.21+1a89239a1`, current Chrome, and current Edge pass the manual checklist.
- URL fragments are cleared when the extension consumes them.
- Pending tasks use session storage only.
- AbleSci values win conflicts; Zotero fills only empty fields.
- All failure modes preserve a manual copy path.
- No source or bundle contains code that submits the AbleSci form.
- Final publication remains an explicit user action.
