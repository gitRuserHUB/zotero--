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

  test("throws when a critical selector is ambiguous", () => {
    document.body.insertAdjacentHTML("beforeend", '<input name="doi">');
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
