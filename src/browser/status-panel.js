const FIELD_LABELS = Object.freeze({
  title: "标题",
  doi: "DOI",
  authors: "作者",
  publicationTitle: "期刊",
  year: "年份",
  url: "官网链接",
});

function displayValue(value) {
  return Array.isArray(value) ? value.join("；") : String(value ?? "");
}

export function createStatusPanel(
  document,
  { copy, cancel, fallbackText = "" },
) {
  document.getElementById("zotero-ablesci-status")?.remove();

  const root = document.createElement("aside");
  root.id = "zotero-ablesci-status";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.innerHTML = `
    <div class="zotero-ablesci-heading">Zotero 科研通助手</div>
    <div class="zotero-ablesci-message"></div>
    <ul class="zotero-ablesci-conflicts"></ul>
    <div class="zotero-ablesci-fallback"></div>
    <div class="zotero-ablesci-actions">
      <button type="button" data-action="copy">复制全部元数据</button>
      <button type="button" data-action="cancel">取消本次填充</button>
    </div>`;
  document.body.append(root);

  const message = root.querySelector(".zotero-ablesci-message");
  const conflictList = root.querySelector(".zotero-ablesci-conflicts");
  const fallback = root.querySelector(".zotero-ablesci-fallback");

  function show(level, text, conflicts = []) {
    root.dataset.level = level;
    message.textContent = text;
    conflictList.replaceChildren();
    for (const conflict of conflicts) {
      const item = document.createElement("li");
      const label = FIELD_LABELS[conflict.field] ?? conflict.field;
      item.textContent = `${label}存在差异：科研通“${displayValue(
        conflict.site,
      )}”；Zotero“${displayValue(conflict.zotero)}”`;
      conflictList.append(item);
    }
  }

  root.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    try {
      await copy();
      show("success", "元数据已复制");
    } catch {
      show("warning", "无法自动写入剪贴板，请手动复制下方元数据");
      fallback.replaceChildren();
      const textarea = document.createElement("textarea");
      textarea.readOnly = true;
      textarea.value = fallbackText;
      textarea.setAttribute("aria-label", "待复制的文献元数据");
      fallback.append(textarea);
    }
  });

  root.querySelector('[data-action="cancel"]').addEventListener("click", () => {
    void cancel();
  });

  return {
    root,
    showReading: () => show("info", "正在读取 Zotero 元数据"),
    showLoginRequired: () =>
      show("warning", "请先登录科研通，登录后将继续自动填写"),
    showQuerying: () => show("info", "正在通过 DOI 查询"),
    showReady: (conflicts = []) =>
      show("success", "已自动填充，请核对后发布", conflicts),
    showWarning: (text) => show("warning", text),
    showError: (text) => show("error", text),
    destroy: () => root.remove(),
  };
}
