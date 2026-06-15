// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";

import { createPluginRuntime } from "../../src/zotero/plugin.js";

function createZotero(windows = []) {
  const progress = {
    changeHeadline: vi.fn(),
    addDescription: vi.fn(),
    show: vi.fn(),
  };
  return {
    getMainWindows: () => windows,
    Items: { getAsync: vi.fn() },
    Utilities: { Internal: { copyTextToClipboard: vi.fn() } },
    launchURL: vi.fn(),
    ProgressWindow: vi.fn(function ProgressWindow() {
      return progress;
    }),
    debug: vi.fn(),
    __progress: progress,
  };
}

function createWindow() {
  const doc = document.implementation.createHTMLDocument("Zotero");
  doc.body.innerHTML = `
    <div id="zotero-items-toolbar"></div>
    <div id="zotero-itemmenu"></div>`;
  return {
    document: doc,
    ZoteroPane: { getSelectedItems: vi.fn(() => []) },
  };
}

describe("Zotero plugin runtime", () => {
  test("adds and removes controls in all main windows", () => {
    const windows = [createWindow(), createWindow()];
    const zotero = createZotero(windows);
    const runtime = createPluginRuntime(zotero);
    runtime.init({ rootURI: "resource://plugin/", id: "id", version: "0.1.0" });

    runtime.addToAllWindows();
    expect(
      windows.every((win) =>
        win.document.querySelector("#ablesci-toolbar-button"),
      ),
    ).toBe(true);

    runtime.removeFromAllWindows();
    expect(
      windows.every(
        (win) => !win.document.querySelector("#ablesci-toolbar-button"),
      ),
    ).toBe(true);
  });

  test("wires selected items, attachment lookup, clipboard, URL, and notifier", async () => {
    const win = createWindow();
    const zotero = createZotero([win]);
    const commandFactory = vi.fn((deps) => async () => {
      expect(deps.getSelectedItems()).toEqual([]);
      await deps.getItemByID(42);
      await deps.writeClipboard("metadata");
      await deps.openUrl("https://www.ablesci.com/");
      deps.notify("success", "done");
    });
    const runtime = createPluginRuntime(zotero, { commandFactory });
    runtime.init({ rootURI: "resource://plugin/", id: "id", version: "0.1.0" });
    runtime.addToWindow(win);

    win.document
      .querySelector("#ablesci-toolbar-button")
      .dispatchEvent(new Event("command"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(commandFactory).toHaveBeenCalledOnce();
    expect(zotero.Items.getAsync).toHaveBeenCalledWith(42);
    expect(zotero.Utilities.Internal.copyTextToClipboard).toHaveBeenCalledWith(
      "metadata",
    );
    expect(zotero.launchURL).toHaveBeenCalledWith("https://www.ablesci.com/");
    expect(zotero.__progress.changeHeadline).toHaveBeenCalledWith("科研通求助");
    expect(zotero.__progress.addDescription).toHaveBeenCalledWith("done");
    expect(zotero.__progress.show).toHaveBeenCalled();
  });

  test("requires initialization before adding UI", () => {
    const runtime = createPluginRuntime(createZotero());
    expect(() => runtime.addToWindow(createWindow())).toThrow(
      "PLUGIN_NOT_INITIALIZED",
    );
  });
});
