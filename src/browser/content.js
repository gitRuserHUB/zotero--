import { formatMetadataText } from "../shared/clipboard.js";
import { consumeFragment } from "./fragment.js";
import { createAbleSciAdapter } from "./dom-adapter.js";
import { createSessionClient } from "./session-client.js";
import { createStatusPanel } from "./status-panel.js";
import { runWorkflow } from "./workflow.js";

function createPanel(document, store, item) {
  const fallbackText = item ? formatMetadataText(item) : "";
  let panel;
  panel = createStatusPanel(document, {
    fallbackText,
    copy: () => globalThis.navigator.clipboard.writeText(fallbackText),
    cancel: async () => {
      await store.clear();
      panel.destroy();
    },
  });
  return panel;
}

export async function startContentScript({
  document = globalThis.document,
  store = createSessionClient(),
} = {}) {
  let task;

  try {
    task = consumeFragment();
    if (task) await store.save(task);
    else task = await store.load();
  } catch {
    const panel = createPanel(document, store, null);
    panel.showError("Zotero 元数据无效或已过期，请返回 Zotero 重新发起");
    return;
  }

  if (!task?.item) return;

  const panel = createPanel(document, store, task.item);
  panel.showReading();
  await runWorkflow({
    task,
    store,
    panel,
    adapter: createAbleSciAdapter(document),
  });
}

if (globalThis.chrome?.runtime?.sendMessage && globalThis.document) {
  void startContentScript();
}
