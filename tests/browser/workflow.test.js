import fs from "node:fs";
import { describe, expect, test, vi } from "vitest";

import { runWorkflow } from "../../src/browser/workflow.js";

const task = {
  item: {
    title: "Zotero title",
    doi: "10.1000/paper",
    authors: ["Lovelace, Ada"],
    publicationTitle: "Journal",
    year: "2026",
    url: "https://publisher.example/paper",
  },
};

function panel() {
  return {
    showLoginRequired: vi.fn(),
    showQuerying: vi.fn(),
    showReady: vi.fn(),
    showWarning: vi.fn(),
    showError: vi.fn(),
  };
}

describe("browser workflow", () => {
  test("keeps a pending task on the login page", async () => {
    const store = { save: vi.fn(), clear: vi.fn() };
    const status = panel();

    await runWorkflow({
      task,
      store,
      panel: status,
      adapter: { isLoginPage: () => true },
    });

    expect(store.save).toHaveBeenCalledWith(task);
    expect(store.clear).not.toHaveBeenCalled();
    expect(status.showLoginRequired).toHaveBeenCalledOnce();
  });

  test("keeps the task and navigates to the create page", async () => {
    const store = { save: vi.fn(), clear: vi.fn() };
    const navigateToCreate = vi.fn();

    await runWorkflow({
      task,
      store,
      panel: panel(),
      adapter: { isLoginPage: () => false, isCreatePage: () => false },
      navigateToCreate,
    });

    expect(store.save).toHaveBeenCalledWith(task);
    expect(navigateToCreate).toHaveBeenCalledOnce();
  });

  test("queries DOI, preserves site values, fills blanks, and clears task", async () => {
    const adapter = {
      isLoginPage: () => false,
      isCreatePage: () => true,
      queryDoi: vi.fn(),
      readValues: vi.fn(() => ({
        title: "Site title",
        doi: "10.1000/paper",
        publicationTitle: "",
      })),
      writeEmptyFields: vi.fn(),
    };
    const store = { save: vi.fn(), clear: vi.fn() };
    const status = panel();

    await runWorkflow({ task, store, panel: status, adapter });

    expect(status.showQuerying).toHaveBeenCalledOnce();
    expect(adapter.queryDoi).toHaveBeenCalledWith(
      "10.1000/paper",
      expect.any(Object),
    );
    expect(adapter.writeEmptyFields).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Site title",
        publicationTitle: "Journal",
      }),
    );
    expect(status.showReady).toHaveBeenCalledWith(
      [expect.objectContaining({ field: "title" })],
      "",
    );
    expect(store.clear).toHaveBeenCalledOnce();
  });

  test("falls back to Zotero fields after DOI query failure", async () => {
    const adapter = {
      isLoginPage: () => false,
      isCreatePage: () => true,
      queryDoi: vi.fn(async () => {
        throw new Error("DOI_QUERY_TIMEOUT");
      }),
      readValues: vi.fn(() => ({})),
      writeEmptyFields: vi.fn(),
    };
    const status = panel();

    await runWorkflow({
      task,
      store: { save: vi.fn(), clear: vi.fn() },
      panel: status,
      adapter,
    });

    expect(status.showWarning).toHaveBeenCalledWith(
      "DOI 查询失败，已改用 Zotero 元数据填充",
    );
    expect(adapter.writeEmptyFields).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Zotero title" }),
    );
  });

  test("warns when an item has neither DOI nor official URL", async () => {
    const noLinkTask = { item: { ...task.item, doi: "", url: "" } };
    const status = panel();

    await runWorkflow({
      task: noLinkTask,
      store: { save: vi.fn(), clear: vi.fn() },
      panel: status,
      adapter: {
        isLoginPage: () => false,
        isCreatePage: () => true,
        readValues: () => ({}),
        writeEmptyFields: vi.fn(),
      },
    });

    expect(status.showReady).toHaveBeenCalledWith(
      [],
      "请重点核对并补充官网链接",
    );
  });

  test("stops safely when the page adapter cannot identify fields", async () => {
    const store = { save: vi.fn(), clear: vi.fn() };
    const status = panel();

    await runWorkflow({
      task,
      store,
      panel: status,
      adapter: {
        isLoginPage: () => false,
        isCreatePage: () => true,
        queryDoi: vi.fn(),
        readValues: () => {
          throw new Error("AMBIGUOUS_FIELD:title");
        },
      },
    });

    expect(status.showError).toHaveBeenCalledWith(
      "科研通页面结构已变化，无法安全自动填写；请复制元数据后手动填写",
    );
    expect(store.clear).not.toHaveBeenCalled();
  });
});

test("production browser code has no form-submission path", () => {
  const source = ["content.js", "workflow.js", "dom-adapter.js"]
    .map((file) => fs.readFileSync(`src/browser/${file}`, "utf8"))
    .join("\n");

  expect(source).not.toMatch(/requestSubmit/u);
  expect(source).not.toMatch(/\.submit\s*\(/u);
  expect(source).not.toMatch(/\[type=["']submit["']\]/u);
  expect(source).not.toMatch(/发布求助.*(?:querySelector|click)/u);
});
