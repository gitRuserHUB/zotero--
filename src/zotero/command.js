const ABLESCI_CREATE_URL = "https://www.ablesci.com/assist/create";

const MESSAGES = Object.freeze({
  NO_SELECTION: "请先选择一篇文献",
  MULTIPLE_SELECTION: "首版仅支持一次求助一篇文献",
  REGULAR_ITEM_REQUIRED: "请选择普通文献条目，而不是附件、笔记或批注",
  TITLE_REQUIRED: "该条目缺少标题，请先在 Zotero 中补充",
});

export function createRequestCommand(deps) {
  return async function requestOnAbleSci() {
    let url;

    try {
      const item = deps.validateSelection(await deps.getSelectedItems());
      if (await deps.hasPdfAttachment(item)) {
        deps.notify("warning", "该文献已有 PDF，无需发起求助");
        return;
      }

      const metadata = deps.extractMetadata(item);
      const payload = deps.buildPayload(metadata, {
        now: deps.now(),
        nonce: deps.nonce(),
      });
      const fragment = deps.encodeFragment(payload);
      const fallbackText = deps.formatMetadataText(metadata);

      await deps.writeClipboard(fallbackText);
      url = `${ABLESCI_CREATE_URL}${fragment}`;
    } catch (error) {
      const message = MESSAGES[error?.message];
      if (message) {
        deps.notify("warning", message);
      } else {
        deps.notify("error", "发起科研通求助失败，请检查 Zotero 调试日志");
      }
      return;
    }

    try {
      await deps.openUrl(url);
      deps.notify("success", "已打开科研通，请核对后发布");
    } catch {
      deps.notify(
        "error",
        "无法打开科研通；文献元数据已保留在剪贴板，可手动粘贴",
      );
    }
  };
}
