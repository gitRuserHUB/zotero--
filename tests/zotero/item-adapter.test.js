import { describe, expect, test } from "vitest";

import {
  extractMetadata,
  hasPdfAttachment,
  validateSelection,
} from "../../src/zotero/item-adapter.js";

function item(fields = {}, extra = {}) {
  return {
    key: "ABCD1234",
    itemType: "journalArticle",
    isRegularItem: () => true,
    getField: (name) => fields[name] ?? "",
    getCreators: () => [
      {
        firstName: "Ada",
        lastName: "Lovelace",
        creatorType: "author",
      },
    ],
    getAttachments: () => [],
    ...extra,
  };
}

describe("Zotero selection validation", () => {
  test("rejects zero, multiple, and non-regular selections", () => {
    expect(() => validateSelection([])).toThrow("NO_SELECTION");
    expect(() => validateSelection([item(), item()])).toThrow(
      "MULTIPLE_SELECTION",
    );
    expect(() =>
      validateSelection([item({}, { isRegularItem: () => false })]),
    ).toThrow("REGULAR_ITEM_REQUIRED");
  });

  test("returns the selected regular item", () => {
    const selected = item();
    expect(validateSelection([selected])).toBe(selected);
  });
});

describe("Zotero metadata extraction", () => {
  test("extracts and normalizes supported fields", () => {
    expect(
      extractMetadata(
        item({
          title: " Paper ",
          DOI: "10.1000/Test",
          publicationTitle: "Journal",
          date: "2026-04-10",
          url: "https://publisher.example/paper",
        }),
      ),
    ).toEqual({
      zoteroKey: "ABCD1234",
      itemType: "journalArticle",
      title: "Paper",
      doi: "10.1000/test",
      authors: ["Lovelace, Ada"],
      publicationTitle: "Journal",
      year: "2026",
      url: "https://publisher.example/paper",
    });
  });

  test("uses institutional authors and ignores non-author creators", () => {
    const selected = item(
      { title: "Paper", bookTitle: "Collected Works" },
      {
        getCreators: () => [
          { name: "WHO", creatorType: "author" },
          { firstName: "Ed", lastName: "Itor", creatorType: "editor" },
          { firstName: "Alan", lastName: "Turing", creatorTypeID: 1 },
        ],
      },
    );

    expect(extractMetadata(selected)).toMatchObject({
      authors: ["WHO", "Turing, Alan"],
      publicationTitle: "Collected Works",
    });
  });

  test("falls back from book title to proceedings title", () => {
    expect(
      extractMetadata(
        item({ title: "Paper", proceedingsTitle: "Proceedings" }),
      ).publicationTitle,
    ).toBe("Proceedings");
  });
});

describe("PDF attachment detection", () => {
  test.each([
    [{ attachmentContentType: "application/pdf" }, "MIME type"],
    [{ getField: (name) => (name === "url" ? "https://x/paper.PDF?download=1" : "") }, "URL"],
    [{ getField: (name) => (name === "path" ? "C:\\papers\\paper.pdf" : "") }, "path"],
    [{ attachmentFilename: "paper.pdf" }, "filename"],
  ])("detects PDF from %s", async (attachment) => {
    const selected = item({}, { getAttachments: () => [1] });
    expect(
      await hasPdfAttachment(selected, { getByID: async () => attachment }),
    ).toBe(true);
  });

  test("checks all children and tolerates missing attachment records", async () => {
    const records = new Map([
      [2, { attachmentContentType: "text/html", getField: () => "" }],
      [3, { attachmentFilename: "fulltext.pdf" }],
    ]);
    const selected = item({}, { getAttachments: () => [1, 2, 3] });

    expect(
      await hasPdfAttachment(selected, {
        getByID: async (id) => records.get(id),
      }),
    ).toBe(true);
  });

  test("returns false when no child is explicitly a PDF", async () => {
    const selected = item({}, { getAttachments: () => [1] });
    expect(
      await hasPdfAttachment(selected, {
        getByID: async () => ({
          attachmentContentType: "text/html",
          attachmentFilename: "snapshot.html",
          getField: () => "https://example.com/article",
        }),
      }),
    ).toBe(false);
  });
});
