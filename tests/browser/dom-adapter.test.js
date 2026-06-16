// @vitest-environment jsdom

import fs from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createAbleSciAdapter } from "../../src/browser/dom-adapter.js";

const fixture = fs.readFileSync("tests/fixtures/ablesci-create.html", "utf8");

describe("AbleSci DOM adapter", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = fixture;
  });

  test("identifies login and request pages", () => {
    expect(createAbleSciAdapter(document).isCreatePage()).toBe(true);
    document.documentElement.innerHTML = fs.readFileSync(
      "tests/fixtures/ablesci-login.html",
      "utf8",
    );
    expect(createAbleSciAdapter(document).isLoginPage()).toBe(true);
  });

  test("reads values and writes only empty fields", () => {
    document.querySelector('[name="title"]').value = "Site title";
    const authorInput = document.querySelector('[name="author"]');
    const inputEvent = vi.fn();
    authorInput.addEventListener("input", inputEvent);
    const adapter = createAbleSciAdapter(document);

    adapter.writeEmptyFields({
      title: "Zotero title",
      authors: ["Lovelace, Ada", "Turing, Alan"],
      publicationTitle: "Journal",
      year: "2026",
      url: "https://publisher.example/paper",
    });

    expect(adapter.readValues()).toMatchObject({
      title: "Site title",
      authors: "Lovelace, Ada；Turing, Alan",
      publicationTitle: "Journal",
      year: "2026",
      url: "https://publisher.example/paper",
    });
    expect(inputEvent).toHaveBeenCalledOnce();
  });

  test("matches common Chinese labels when field names changed", () => {
    document.documentElement.innerHTML = `
      <form>
        <label>DOI 号 <input /></label>
        <label>文献标题 <textarea></textarea></label>
        <label>作者信息 <input /></label>
        <label>期刊名称 <input /></label>
        <label>发表年份 <input /></label>
        <label>官网链接 <input /></label>
        <button type="button">检索</button>
      </form>`;
    const adapter = createAbleSciAdapter(document);

    adapter.writeEmptyFields({
      doi: "10.1000/paper",
      title: "Paper",
      authors: ["Lovelace, Ada"],
      publicationTitle: "Journal",
      year: "2026",
      url: "https://publisher.example/paper",
    });

    expect(adapter.readValues()).toMatchObject({
      doi: "10.1000/paper",
      title: "Paper",
      authors: "Lovelace, Ada",
      publicationTitle: "Journal",
      year: "2026",
      url: "https://publisher.example/paper",
    });
  });

  test("prefers the request form field when a page search field has the same title name", () => {
    document.documentElement.innerHTML = `
      <form id="site-search">
        <input name="title" placeholder="标题搜索" value="">
      </form>
      <form id="request-form">
        <label>DOI 号 <input name="doi"></label>
        <label>文献标题 <input name="title"></label>
        <label>作者 <input name="author"></label>
        <label>期刊 <input name="journal"></label>
        <label>年份 <input name="year"></label>
        <label>官网链接 <input name="url"></label>
      </form>`;
    const adapter = createAbleSciAdapter(document);

    adapter.writeEmptyFields({
      title: "Zotero title",
      authors: ["Lovelace, Ada"],
      publicationTitle: "Journal",
      year: "2026",
      url: "https://publisher.example/paper",
    });

    expect(document.querySelector("#site-search [name='title']").value).toBe("");
    expect(document.querySelector("#request-form [name='title']").value).toBe(
      "Zotero title",
    );
  });

  test("fills AbleSci manual fields instead of the one-click AI query box", () => {
    document.documentElement.innerHTML = `
      <form class="layui-form">
        <div class="layui-form-item ablesci-ai-box">
          <label class="layui-form-label">一键求助</label>
          <div class="layui-input-block">
            <input id="ai-query" placeholder="请输入DOI、PMID 或 标题">
            <button type="button">智能提取文献信息</button>
          </div>
        </div>
        <div class="layui-form-item">
          <label class="layui-form-label">DOI</label>
          <div class="layui-input-block">
            <input placeholder="选填，强烈建议输入，如10.1126/science.aba208">
          </div>
        </div>
        <div class="layui-form-item">
          <label class="layui-form-label">标题 <span>*</span></label>
          <div class="layui-input-block">
            <input placeholder="请正确填写，不要输入标题以外的任何其它信息">
          </div>
        </div>
        <div class="layui-form-item">
          <label class="layui-form-label">文献链接</label>
          <div class="layui-input-block">
            <input placeholder="选填项，请输入文章的原始官方链接">
          </div>
        </div>
        <div class="layui-form-item">
          <label class="layui-form-label">其他信息</label>
          <div class="layui-input-block">
            <textarea placeholder="为了便于他人准确应助，建议补全文献的其它信息，如作者、期刊、卷期号、页码等"></textarea>
          </div>
        </div>
      </form>`;
    const adapter = createAbleSciAdapter(document);

    adapter.writeEmptyFields({
      doi: "10.1000/paper",
      title: "Zotero title",
      authors: ["Lovelace, Ada"],
      publicationTitle: "Journal",
      year: "2026",
      url: "https://publisher.example/paper",
    });

    expect(document.querySelector("#ai-query").value).toBe("");
    expect(
      document.querySelector(".layui-form-item:nth-of-type(2) input").value,
    ).toBe("10.1000/paper");
    expect(
      document.querySelector(".layui-form-item:nth-of-type(3) input").value,
    ).toBe("Zotero title");
    expect(
      document.querySelector(".layui-form-item:nth-of-type(4) input").value,
    ).toBe("https://publisher.example/paper");
    expect(document.querySelector("textarea").value).toContain("Journal");
  });

  test("uses the AbleSci one-click AI box only for DOI extraction", async () => {
    document.documentElement.innerHTML = `
      <form class="layui-form">
        <div class="layui-form-item ablesci-ai-box">
          <label class="layui-form-label">一键求助</label>
          <div class="layui-input-block">
            <input id="ai-query" placeholder="请输入DOI、PMID 或 标题">
            <button type="button">智能提取文献信息</button>
          </div>
        </div>
        <div class="layui-form-item">
          <label class="layui-form-label">DOI</label>
          <div class="layui-input-block"><input id="manual-doi"></div>
        </div>
        <div class="layui-form-item">
          <label class="layui-form-label">标题 <span>*</span></label>
          <div class="layui-input-block"><input id="manual-title"></div>
        </div>
      </form>`;
    const query = document.querySelector("button");
    vi.spyOn(query, "click");
    query.addEventListener("click", () => {
      document.querySelector("#manual-title").value = "Queried title";
    });

    await createAbleSciAdapter(document).queryDoi("10.1000/paper", {
      timeoutMs: 200,
      pollMs: 5,
    });

    expect(document.querySelector("#ai-query").value).toBe("10.1000/paper");
    expect(document.querySelector("#manual-doi").value).toBe("");
    expect(document.querySelector("#manual-title").value).toBe("Queried title");
    expect(query.click).toHaveBeenCalledOnce();
  });

  test("ignores fields hidden by an ancestor", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div hidden><input name="doi" value="hidden"></div>',
    );

    expect(createAbleSciAdapter(document).readValues().doi).toBe("");
  });

  test("fills DOI and clicks only the query control", async () => {
    const query = document.querySelector('[data-testid="doi-query"]');
    const publish = document.querySelector('[data-testid="publish"]');
    vi.spyOn(query, "click");
    vi.spyOn(publish, "click");
    query.addEventListener("click", () => {
      document.querySelector('[name="title"]').value = "Queried title";
    });

    await createAbleSciAdapter(document).queryDoi("10.1000/paper", {
      timeoutMs: 200,
      pollMs: 5,
    });

    expect(document.querySelector('[name="doi"]').value).toBe(
      "10.1000/paper",
    );
    expect(query.click).toHaveBeenCalledOnce();
    expect(publish.click).not.toHaveBeenCalled();
  });

  test("rejects an explicit DOI query error", async () => {
    document
      .querySelector('[data-testid="doi-query"]')
      .addEventListener("click", () => {
        const error = document.querySelector('[data-testid="doi-error"]');
        error.hidden = false;
        error.textContent = "未查询到文献";
      });

    await expect(
      createAbleSciAdapter(document).queryDoi("10.1000/missing", {
        timeoutMs: 200,
        pollMs: 5,
      }),
    ).rejects.toThrow("DOI_QUERY_FAILED");
  });

  test("times out when a DOI query produces no result", async () => {
    await expect(
      createAbleSciAdapter(document).queryDoi("10.1000/slow", {
        timeoutMs: 20,
        pollMs: 5,
      }),
    ).rejects.toThrow("DOI_QUERY_TIMEOUT");
  });

  test("rejects and cleans up when the query control throws", async () => {
    const query = document.querySelector('[data-testid="doi-query"]');
    vi.spyOn(query, "click").mockImplementation(() => {
      throw new Error("query click failed");
    });

    await expect(
      createAbleSciAdapter(document).queryDoi("10.1000/broken", {
        timeoutMs: 200,
        pollMs: 5,
      }),
    ).rejects.toThrow("query click failed");
  });

  test("throws when duplicate critical fields cannot be disambiguated", () => {
    document.documentElement.innerHTML = `
      <form><label>DOI <input name="doi"></label></form>
      <form><label>DOI <input name="doi"></label></form>`;
    expect(() => createAbleSciAdapter(document).readValues()).toThrow(
      "AMBIGUOUS_FIELD:doi",
    );
  });

  test("never exposes a publish or generic submit operation", () => {
    const adapter = createAbleSciAdapter(document);
    expect(adapter.publish).toBeUndefined();
    expect(adapter.submit).toBeUndefined();
  });
});
