import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { buildAll } from "../../scripts/build.mjs";
import {
  expectedArtifactEntries,
  verifyStagedArtifacts,
} from "../../scripts/verify-artifacts.mjs";

async function createTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "ablesci-artifacts-"));
}

async function writeFile(root, relativePath, contents = "fixture") {
  const filePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
  return filePath;
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
    ["missing", "missing", async () => {}],
    ["empty", "empty file", async (entryPath) => fs.writeFile(entryPath, "")],
    ["directory", "not a regular file", async (entryPath) => {
      await fs.rm(entryPath, { force: true });
      await fs.mkdir(entryPath);
    }],
  ])("rejects a %s staged entry", async (kind, reason, makeInvalid) => {
    const root = await createTempRoot();
    await writeAllStagedArtifacts(root);
    const invalidPath = path.join(root, "dist", "zotero", "manifest.json");

    if (kind === "missing") {
      await fs.rm(invalidPath, { force: true });
    } else {
      await makeInvalid(invalidPath);
    }

    await expect(verifyStagedArtifacts(root)).rejects.toThrow(
      new RegExp(`dist[\\\\/]zotero[\\\\/]manifest\\.json \\(${reason}\\)`),
    );
  });

  test("builds safely without source files and preserves unrelated dist files", async () => {
    const root = await createTempRoot();
    await writePackage(root);
    await writeFile(root, path.join("dist", "sentinel.txt"), "keep");
    await writeAllStagedArtifacts(root);

    await buildAll(root);

    await expect(
      fs.readFile(path.join(root, "dist", "sentinel.txt"), "utf8"),
    ).resolves.toBe("keep");
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
  });
});
