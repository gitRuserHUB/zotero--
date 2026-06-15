import { describe, expect, test, vi } from "vitest";

import { createRequestCommand } from "../../src/zotero/command.js";

function successfulDependencies(overrides = {}) {
  return {
    getSelectedItems: () => [{ key: "ABCD1234" }],
    validateSelection: (items) => items[0],
    hasPdfAttachment: async () => false,
    extractMetadata: () => ({
      title: "Paper",
      doi: "10.1000/paper",
      authors: [],
    }),
    buildPayload: (item, options) => ({
      v: 1,
      createdAt: options.now,
      nonce: options.nonce,
      item,
    }),
    encodeFragment: () => "#zotero-ablesci=encoded",
    formatMetadataText: () => "标题：Paper",
    writeClipboard: vi.fn(),
    openUrl: vi.fn(),
    notify: vi.fn(),
    now: () => 123,
    nonce: () => "nonce-1",
    ...overrides,
  };
}

describe("Zotero request command", () => {
  test("copies fallback text, opens AbleSci, and reports success", async () => {
    const deps = successfulDependencies();

    await createRequestCommand(deps)();

    expect(deps.writeClipboard).toHaveBeenCalledWith("标题：Paper");
    expect(deps.openUrl).toHaveBeenCalledWith(
      "https://www.ablesci.com/assist/create#zotero-ablesci=encoded",
    );
    expect(deps.notify).toHaveBeenCalledWith(
      "success",
      "已打开科研通，请核对后发布",
    );
  });

  test("passes the injected clock and nonce to payload creation", async () => {
    const buildPayload = vi.fn((item) => ({ item }));
    const deps = successfulDependencies({ buildPayload });

    await createRequestCommand(deps)();

    expect(buildPayload).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Paper" }),
      { now: 123, nonce: "nonce-1" },
    );
  });

  test("blocks an item that already has a PDF", async () => {
    const deps = successfulDependencies({ hasPdfAttachment: async () => true });

    await createRequestCommand(deps)();

    expect(deps.writeClipboard).not.toHaveBeenCalled();
    expect(deps.openUrl).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(
      "warning",
      "该文献已有 PDF，无需发起求助",
    );
  });

  test.each([
    ["NO_SELECTION", "请先选择一篇文献"],
    ["MULTIPLE_SELECTION", "首版仅支持一次求助一篇文献"],
    [
      "REGULAR_ITEM_REQUIRED",
      "请选择普通文献条目，而不是附件、笔记或批注",
    ],
    ["TITLE_REQUIRED", "该条目缺少标题，请先在 Zotero 中补充"],
  ])("maps %s to a Chinese warning", async (code, message) => {
    const deps = successfulDependencies({
      validateSelection: () => {
        throw new Error(code);
      },
    });

    await createRequestCommand(deps)();

    expect(deps.notify).toHaveBeenCalledWith("warning", message);
    expect(deps.openUrl).not.toHaveBeenCalled();
  });

  test("reports browser-open failure while retaining clipboard fallback", async () => {
    const deps = successfulDependencies({
      openUrl: vi.fn(() => {
        throw new Error("launch failed");
      }),
    });

    await createRequestCommand(deps)();

    expect(deps.writeClipboard).toHaveBeenCalledOnce();
    expect(deps.notify).toHaveBeenCalledWith(
      "error",
      "无法打开科研通；文献元数据已保留在剪贴板，可手动粘贴",
    );
  });

  test("reports unexpected errors without attempting to open the page", async () => {
    const deps = successfulDependencies({
      extractMetadata: () => {
        throw new Error("unexpected");
      },
    });

    await createRequestCommand(deps)();

    expect(deps.openUrl).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(
      "error",
      "发起科研通求助失败，请检查 Zotero 调试日志",
    );
  });
});
