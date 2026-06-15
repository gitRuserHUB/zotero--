import { describe, expect, test } from "vitest";
import { expectedArtifactEntries } from "../../scripts/verify-artifacts.mjs";

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
});
