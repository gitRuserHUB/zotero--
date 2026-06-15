import { describe, expect, test } from "vitest";

import { mergeFormValues } from "../../src/shared/merge.js";

describe("AbleSci-first metadata merge", () => {
  test("keeps non-empty site values and fills empty fields from Zotero", () => {
    const result = mergeFormValues(
      {
        title: "Site title",
        doi: "10.1000/site",
        authors: [],
        publicationTitle: "",
        year: "2026",
        url: "https://site.example/paper",
      },
      {
        title: "Zotero title",
        doi: "10.1000/zotero",
        authors: ["Lovelace, Ada"],
        publicationTitle: "Journal",
        year: "2025",
        url: "https://zotero.example/paper",
      },
    );

    expect(result.values).toEqual({
      title: "Site title",
      doi: "10.1000/site",
      authors: ["Lovelace, Ada"],
      publicationTitle: "Journal",
      year: "2026",
      url: "https://site.example/paper",
    });
    expect(result.conflicts.map(({ field }) => field)).toEqual([
      "title",
      "doi",
      "year",
      "url",
    ]);
  });

  test("compares DOI values case-insensitively", () => {
    expect(
      mergeFormValues(
        { doi: "10.1000/ABC", title: "Paper" },
        { doi: "10.1000/abc", title: "Paper" },
      ).conflicts,
    ).toEqual([]);
  });

  test("treats whitespace-only site strings and empty arrays as empty", () => {
    const result = mergeFormValues(
      { title: "  ", authors: [], publicationTitle: null },
      {
        title: "Paper",
        authors: ["Lovelace, Ada"],
        publicationTitle: "Journal",
      },
    );

    expect(result.values.title).toBe("Paper");
    expect(result.values.authors).toEqual(["Lovelace, Ada"]);
    expect(result.values.publicationTitle).toBe("Journal");
    expect(result.conflicts).toEqual([]);
  });

  test("compares author arrays by normalized joined text while preserving site data", () => {
    const result = mergeFormValues(
      { authors: ["Ada   Lovelace", "Alan Turing"] },
      { authors: ["Ada Lovelace", "Grace Hopper"] },
    );

    expect(result.values.authors).toEqual(["Ada   Lovelace", "Alan Turing"]);
    expect(result.conflicts).toEqual([
      {
        field: "authors",
        site: ["Ada   Lovelace", "Alan Turing"],
        zotero: ["Ada Lovelace", "Grace Hopper"],
      },
    ]);
  });

  test("returns the complete supported field shape when both sources omit values", () => {
    expect(mergeFormValues({}, {})).toEqual({
      values: {
        title: "",
        doi: "",
        authors: "",
        publicationTitle: "",
        year: "",
        url: "",
      },
      conflicts: [],
    });
  });
});
