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

  test("declares a conventional ID and Zotero 9 compatible range", () => {
    const manifest = JSON.parse(
      fs.readFileSync("src/zotero/manifest.json", "utf8"),
    );
    expect(manifest.manifest_version).toBe(2);
    expect(manifest.applications.zotero).toMatchObject({
      id: "zotero-ablesci-assistant@ablesci.local",
      update_url:
        "https://www.ablesci.com/zotero-ablesci-assistant-updates.json",
      strict_min_version: "8.0-beta.21",
      strict_max_version: "10.99.99",
    });
  });
});
