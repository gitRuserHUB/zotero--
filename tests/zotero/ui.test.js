// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";

import { addWindowUi, removeWindowUi } from "../../src/zotero/ui.js";

function dispatchCommand(element) {
  element.dispatchEvent(new Event("command", { bubbles: true }));
}

describe("Zotero window UI", () => {
  test("adds toolbar and context-menu entry points with one command handler", () => {
    document.body.innerHTML = `
      <div id="zotero-items-toolbar"></div>
      <div id="zotero-itemmenu"></div>`;
    const onCommand = vi.fn();

    addWindowUi({ document }, { onCommand, iconUrl: "icon.svg" });

    const toolbar = document.querySelector("#ablesci-toolbar-button");
    const menu = document.querySelector("#ablesci-item-menu");
    expect(toolbar.getAttribute("label")).toBe("科研通求助");
    expect(toolbar.getAttribute("image")).toBe("icon.svg");
    expect(toolbar.classList.contains("zotero-tb-button")).toBe(true);
    expect(menu.getAttribute("label")).toBe("在科研通发起文献求助");
    expect(menu.classList.contains("menuitem-iconic")).toBe(true);
    dispatchCommand(toolbar);
    dispatchCommand(menu);
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  test("uses the fallback Zotero toolbar host", () => {
    document.body.innerHTML = `
      <div id="zotero-tb"></div>
      <div id="zotero-itemmenu"></div>`;

    addWindowUi({ document }, { onCommand: vi.fn(), iconUrl: "icon.svg" });

    expect(
      document.querySelector("#zotero-tb > #ablesci-toolbar-button"),
    ).not.toBeNull();
  });

  test("does not add duplicate controls to the same window", () => {
    document.body.innerHTML = `
      <div id="zotero-items-toolbar"></div>
      <div id="zotero-itemmenu"></div>`;
    const options = { onCommand: vi.fn(), iconUrl: "icon.svg" };

    addWindowUi({ document }, options);
    addWindowUi({ document }, options);

    expect(document.querySelectorAll("#ablesci-toolbar-button")).toHaveLength(1);
    expect(document.querySelectorAll("#ablesci-item-menu")).toHaveLength(1);
  });

  test("removes both controls symmetrically", () => {
    document.body.innerHTML = `
      <div id="zotero-items-toolbar"></div>
      <div id="zotero-itemmenu"></div>`;
    addWindowUi(
      { document },
      { onCommand: vi.fn(), iconUrl: "icon.svg" },
    );

    removeWindowUi({ document });

    expect(document.querySelector("#ablesci-toolbar-button")).toBeNull();
    expect(document.querySelector("#ablesci-item-menu")).toBeNull();
  });

  test("fails safely when a required UI host is missing", () => {
    document.body.innerHTML = '<div id="zotero-items-toolbar"></div>';
    expect(() =>
      addWindowUi(
        { document },
        { onCommand: vi.fn(), iconUrl: "icon.svg" },
      ),
    ).toThrow("ZOTERO_UI_HOST_NOT_FOUND");
    expect(document.querySelector("#ablesci-toolbar-button")).toBeNull();
  });
});
