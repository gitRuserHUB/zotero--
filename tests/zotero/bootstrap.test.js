import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Zotero bootstrap package files", () => {
  test("declares the required lifecycle functions without restart-only hooks", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/zotero/bootstrap.js"),
      "utf8",
    );
    for (const name of [
      "startup",
      "shutdown",
      "install",
      "uninstall",
      "onMainWindowLoad",
      "onMainWindowUnload",
    ]) {
      expect(source).toContain(`function ${name}`);
    }
    expect(source).toContain("ablesci-assistant.js");
  });

  test("limits manifest compatibility to Zotero 9", () => {
    const manifest = JSON.parse(
      fs.readFileSync("src/zotero/manifest.json", "utf8"),
    );
    expect(manifest.manifest_version).toBe(2);
    expect(manifest.applications.zotero).toMatchObject({
      id: "zotero-ablesci-assistant@local",
      strict_min_version: "9.0-beta.21",
      strict_max_version: "9.0.*",
    });
  });
});
