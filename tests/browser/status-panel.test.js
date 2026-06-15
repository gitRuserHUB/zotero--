// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from "vitest";

import { createStatusPanel } from "../../src/browser/status-panel.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

test("shows conflicts and exposes copy/cancel without a publish action", async () => {
  const copy = vi.fn();
  const cancel = vi.fn();
  const panel = createStatusPanel(document, { copy, cancel });

  panel.showReady([
    { field: "title", site: "Site", zotero: "Zotero" },
    { field: "url", site: "https://site", zotero: "https://zotero" },
  ]);

  expect(panel.root.textContent).toContain("已自动填充，请核对后发布");
  expect(panel.root.textContent).toContain("标题存在差异");
  expect(panel.root.textContent).toContain("官网链接存在差异");
  expect(panel.root.textContent).not.toContain("自动发布");
  panel.root.querySelector('[data-action="copy"]').click();
  panel.root.querySelector('[data-action="cancel"]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(copy).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});

test("renders each workflow state with an accessible status role", () => {
  const panel = createStatusPanel(document, { copy: vi.fn(), cancel: vi.fn() });
  expect(panel.root.getAttribute("role")).toBe("status");

  panel.showReading();
  expect(panel.root.textContent).toContain("正在读取 Zotero 元数据");
  panel.showLoginRequired();
  expect(panel.root.textContent).toContain("请先登录科研通");
  panel.showQuerying();
  expect(panel.root.textContent).toContain("正在通过 DOI 查询");
  panel.showWarning("请补充官网链接");
  expect(panel.root.dataset.level).toBe("warning");
  panel.showError("页面结构已变化");
  expect(panel.root.dataset.level).toBe("error");
});

test("falls back to a readonly textarea when clipboard writing fails", async () => {
  const panel = createStatusPanel(document, {
    copy: async () => {
      throw new Error("denied");
    },
    cancel: vi.fn(),
    fallbackText: "标题：Paper",
  });

  panel.root.querySelector('[data-action="copy"]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const textarea = panel.root.querySelector("textarea");
  expect(textarea.readOnly).toBe(true);
  expect(textarea.value).toBe("标题：Paper");
  expect(panel.root.textContent).toContain("请手动复制下方元数据");
});

test("destroy removes the panel", () => {
  const panel = createStatusPanel(document, { copy: vi.fn(), cancel: vi.fn() });
  panel.destroy();
  expect(document.querySelector("#zotero-ablesci-status")).toBeNull();
});
