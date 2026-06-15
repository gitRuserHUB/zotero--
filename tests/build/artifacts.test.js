import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import yauzl from "yauzl";

import { buildAll } from "../../scripts/build.mjs";
import {
  expectedArtifactEntries,
  verifyStagedArtifacts,
} from "../../scripts/verify-artifacts.mjs";

const tempWorkspaces = [];
let activeWorkspace;

function listArchiveEntries(archivePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true }, (openError, zip) => {
      if (openError) {
        reject(openError);
        return;
      }
      const entries = [];
      zip.on("entry", (entry) => {
        entries.push(entry.fileName);
        zip.readEntry();
      });
      zip.on("end", () => resolve(entries));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

function getWorkspace(root) {
  const workspace = tempWorkspaces.find((candidate) => candidate.root === root);
  if (!workspace) {
    throw new Error(`Unknown temporary workspace: ${root}`);
  }
  return workspace;
}

async function ensureDirectory(workspace, directoryPath) {
  const relativePath = path.relative(workspace.root, directoryPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Directory is outside temporary workspace: ${directoryPath}`);
  }

  let currentPath = workspace.root;
  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment);
    try {
      await fs.mkdir(currentPath);
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
    workspace.directories.add(currentPath);
  }
}

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ablesci-artifacts-"));
  const workspace = {
    root,
    files: new Set(),
    directories: new Set([root]),
  };
  tempWorkspaces.push(workspace);
  activeWorkspace = workspace;
  return root;
}

async function writeFile(root, relativePath, contents = "fixture") {
  const workspace = getWorkspace(root);
  const filePath = path.join(root, relativePath);
  await ensureDirectory(workspace, path.dirname(filePath));
  await fs.writeFile(filePath, contents);
  workspace.files.add(filePath);
  return filePath;
}

async function replaceFileWithDirectory(root, relativePath) {
  const workspace = getWorkspace(root);
  const entryPath = path.join(root, relativePath);
  await fs.rm(entryPath, { force: true });
  workspace.files.delete(entryPath);
  await ensureDirectory(workspace, entryPath);
}

async function trackBuildOutputs(root) {
  const workspace = getWorkspace(root);
  const distPath = path.join(root, "dist");

  for (const [target, entries] of Object.entries(expectedArtifactEntries())) {
    const targetPath = path.join(distPath, target);
    await ensureDirectory(workspace, targetPath);
    for (const entry of entries) {
      workspace.files.add(path.join(targetPath, entry));
    }
  }

  workspace.files.add(
    path.join(distPath, "zotero-ablesci-assistant-0.1.0.xpi"),
  );
  workspace.files.add(
    path.join(distPath, "ablesci-chromium-extension-0.1.0.zip"),
  );
}

async function cleanupWorkspace(workspace) {
  for (const filePath of workspace.files) {
    await fs.rm(filePath, { force: true });
  }

  const directories = [...workspace.directories].sort(
    (left, right) => right.split(path.sep).length - left.split(path.sep).length,
  );
  for (const directoryPath of directories) {
    await fs.rmdir(directoryPath);
  }
}

async function writePackage(root) {
  await writeFile(
    root,
    "package.json",
    JSON.stringify({ name: "fixture", version: "0.1.0", type: "module" }),
  );
}

async function writeAllStagedArtifacts(root) {
  for (const [target, entries] of Object.entries(expectedArtifactEntries())) {
    for (const entry of entries) {
      await writeFile(root, path.join("dist", target, entry));
    }
  }
}

afterEach(async () => {
  if (activeWorkspace) {
    await cleanupWorkspace(activeWorkspace);
    activeWorkspace = undefined;
  }
});

afterAll(async () => {
  for (const workspace of tempWorkspaces) {
    await expect(fs.stat(workspace.root)).rejects.toMatchObject({
      code: "ENOENT",
    });
  }
});

describe("artifact layout", () => {
  test("declares required Zotero and Chromium files", () => {
    expect(expectedArtifactEntries()).toEqual({
      zotero: expect.arrayContaining([
        "manifest.json",
        "bootstrap.js",
        "ablesci-assistant.js",
      ]),
      chromium: expect.arrayContaining([
        "manifest.json",
        "background.js",
        "content.js",
        "status-panel.css",
      ]),
    });
  });

  test("declares the Node version required by locked dependencies", async () => {
    const packageJson = JSON.parse(
      await fs.readFile(new URL("../../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.engines.node).toBe(">=22.13.0");
  });

  test("accepts all non-empty regular staged files", async () => {
    const root = await createTempRoot();
    await writeAllStagedArtifacts(root);

    await expect(verifyStagedArtifacts(root)).resolves.toBeUndefined();
  });

  test.each([
    [
      "missing",
      "missing",
      async (root, relativePath) =>
        fs.rm(path.join(root, relativePath), { force: true }),
    ],
    [
      "empty",
      "empty file",
      async (root, relativePath) => writeFile(root, relativePath, ""),
    ],
    ["directory", "not a regular file", replaceFileWithDirectory],
  ])("rejects a %s staged entry", async (kind, reason, makeInvalid) => {
    const root = await createTempRoot();
    await writeAllStagedArtifacts(root);
    const invalidPath = path.join("dist", "zotero", "manifest.json");

    await makeInvalid(root, invalidPath);

    await expect(verifyStagedArtifacts(root)).rejects.toThrow(
      new RegExp(`dist[\\\\/]zotero[\\\\/]manifest\\.json \\(${reason}\\)`),
    );
  });

  test("builds safely without source files and preserves unrelated dist files", async () => {
    const root = await createTempRoot();
    await writePackage(root);
    const sentinels = [
      path.join("dist", "zotero", "zotero-sentinel.txt"),
      path.join("dist", "chromium", "chromium-sentinel.txt"),
    ];
    for (const sentinel of sentinels) {
      await writeFile(root, sentinel, "keep");
    }
    await writeAllStagedArtifacts(root);
    await trackBuildOutputs(root);

    await buildAll(root);

    for (const sentinel of sentinels) {
      await expect(fs.readFile(path.join(root, sentinel), "utf8")).resolves.toBe(
        "keep",
      );
    }
    for (const [target, entries] of Object.entries(expectedArtifactEntries())) {
      for (const entry of entries) {
        await expect(
          fs.stat(path.join(root, "dist", target, entry)),
        ).rejects.toMatchObject({ code: "ENOENT" });
      }
    }
  });

  test("stages future sources and creates both archives", async () => {
    const root = await createTempRoot();
    await writePackage(root);
    await writeFile(
      root,
      path.join("src", "zotero", "plugin.js"),
      "export const AbleSciAssistant = {};",
    );
    await writeFile(
      root,
      path.join("src", "zotero", "bootstrap.js"),
      "function startup() {}",
    );
    await writeFile(
      root,
      path.join("src", "zotero", "manifest.json"),
      JSON.stringify({ manifest_version: 2, name: "Fixture", version: "0.1.0" }),
    );
    await writeFile(
      root,
      path.join("src", "zotero", "icon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"></svg>',
    );
    await writeFile(
      root,
      path.join("src", "browser", "background.js"),
      "globalThis.fixtureBackground = true;",
    );
    await writeFile(
      root,
      path.join("src", "browser", "content.js"),
      "globalThis.fixtureContent = true;",
    );
    await writeFile(
      root,
      path.join("src", "browser", "manifest.json"),
      JSON.stringify({ manifest_version: 3, name: "Fixture", version: "0.1.0" }),
    );
    await writeFile(
      root,
      path.join("src", "browser", "status-panel.css"),
      ".status-panel { display: block; }",
    );
    await trackBuildOutputs(root);

    await buildAll(root);
    await expect(verifyStagedArtifacts(root)).resolves.toBeUndefined();

    const archives = [
      "zotero-ablesci-assistant-0.1.0.xpi",
      "ablesci-chromium-extension-0.1.0.zip",
    ];
    for (const archive of archives) {
      const stats = await fs.stat(path.join(root, "dist", archive));
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    }

    expect(
      await listArchiveEntries(
        path.join(root, "dist", "zotero-ablesci-assistant-0.1.0.xpi"),
      ),
    ).toEqual(expectedArtifactEntries().zotero);
    expect(
      await listArchiveEntries(
        path.join(root, "dist", "ablesci-chromium-extension-0.1.0.zip"),
      ),
    ).toEqual(expectedArtifactEntries().chromium);
  });

  test("builds repository artifacts with matching versions and restricted permissions", async () => {
    const root = process.cwd();
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

    const result = await buildAll(root);
    await verifyStagedArtifacts(root);

    expect(result.artifacts.map(({ path: artifactPath }) => artifactPath)).toEqual([
      path.join(root, "dist", `zotero-ablesci-assistant-${packageJson.version}.xpi`),
      path.join(root, "dist", `ablesci-chromium-extension-${packageJson.version}.zip`),
    ]);
    expect(result.artifacts.every(({ size }) => size > 0)).toBe(true);

    const zoteroManifest = JSON.parse(
      await fs.readFile("dist/zotero/manifest.json", "utf8"),
    );
    const chromiumManifest = JSON.parse(
      await fs.readFile("dist/chromium/manifest.json", "utf8"),
    );
    expect(zoteroManifest.version).toBe(packageJson.version);
    expect(zoteroManifest.applications.zotero).toMatchObject({
      id: "zotero-ablesci-assistant@ablesci.local",
      strict_min_version: "8.0-beta.21",
      strict_max_version: "10.99.99",
    });
    expect(chromiumManifest.version).toBe(packageJson.version);
    expect(chromiumManifest.manifest_version).toBe(3);
    expect(chromiumManifest.host_permissions).toEqual([
      "https://www.ablesci.com/*",
      "http://www.ablesci.com/*",
    ]);

    const contentBundle = await fs.readFile("dist/chromium/content.js", "utf8");
    expect(contentBundle).not.toMatch(/requestSubmit/u);
    expect(contentBundle).not.toMatch(/\.submit\s*\(/u);
    expect(contentBundle).not.toMatch(/telemetry|analytics|sentry|segment\.com/iu);

    expect(
      await listArchiveEntries(
        path.join(root, "dist", `zotero-ablesci-assistant-${packageJson.version}.xpi`),
      ),
    ).toEqual(expectedArtifactEntries().zotero);
    expect(
      await listArchiveEntries(
        path.join(root, "dist", `ablesci-chromium-extension-${packageJson.version}.zip`),
      ),
    ).toEqual(expectedArtifactEntries().chromium);
  });
});
