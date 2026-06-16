import { PAYLOAD_TTL_MS } from "../shared/constants.js";
import { mergeFormValues } from "../shared/merge.js";

const PAGE_CHANGED_MESSAGE =
  "科研通页面结构已变化，无法安全自动填写";

function defaultNavigateToCreate() {
  const target = new URL("/assist/create", globalThis.location.origin);
  if (target.origin !== globalThis.location.origin) {
    throw new Error("CROSS_ORIGIN_NAVIGATION_BLOCKED");
  }
  globalThis.location.href = target.href;
}

function isExpectedQueryFailure(error) {
  return [
    "DOI_QUERY_FAILED",
    "DOI_QUERY_TIMEOUT",
    "DOI_QUERY_CONTROL_NOT_FOUND",
    "AMBIGUOUS_DOI_QUERY_CONTROL",
    "FIELD_NOT_FOUND:doi",
  ].includes(error?.message);
}

function queryFailureMessage(error) {
  if (error?.message === "DOI_QUERY_CONTROL_NOT_FOUND") {
    return "未找到 DOI 查询按钮，已改用 Zotero 元数据填充";
  }
  if (error?.message === "FIELD_NOT_FOUND:doi") {
    return "未找到 DOI 字段，已改用 Zotero 元数据填充";
  }
  return "DOI 查询失败，已改用 Zotero 元数据填充";
}

function pageChangedMessage(error) {
  return `${PAGE_CHANGED_MESSAGE}：${error?.message ?? "未知错误"}；请复制元数据后手动填写`;
}

export async function runWorkflow({
  task,
  store,
  panel,
  adapter,
  navigateToCreate = defaultNavigateToCreate,
  now = () => Date.now(),
}) {
  try {
    if (
      Number.isFinite(task?.createdAt) &&
      now() - task.createdAt > PAYLOAD_TTL_MS
    ) {
      await store.clear();
      panel.showError("本次 Zotero 文献任务已过期，请返回 Zotero 重新发起");
      return;
    }

    if (adapter.isLoginPage()) {
      await store.save(task);
      panel.showLoginRequired();
      return;
    }

    if (!adapter.isCreatePage()) {
      await store.save(task);
      navigateToCreate();
      return;
    }

    if (task.item.doi) {
      panel.showQuerying();
      try {
        await adapter.queryDoi(task.item.doi, { timeoutMs: 10_000 });
      } catch (error) {
        if (!isExpectedQueryFailure(error)) throw error;
        panel.showWarning(queryFailureMessage(error));
      }
    }

    const { values, conflicts } = mergeFormValues(
      adapter.readValues(),
      task.item,
    );
    adapter.writeEmptyFields(values);
    await store.clear();

    const warning =
      !task.item.doi && !task.item.url ? "请重点核对并补充官网链接" : "";
    panel.showReady(conflicts, warning);
  } catch (error) {
    panel.showError(pageChangedMessage(error));
  }
}
