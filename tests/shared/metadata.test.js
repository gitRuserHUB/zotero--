import { describe, expect, test } from "vitest";

import {
  FRAGMENT_PREFIX,
  MAX_LENGTHS,
  PAYLOAD_TTL_MS,
  PROTOCOL_VERSION,
} from "../../src/shared/constants.js";
import {
  normalizeDoi,
  normalizeMetadata,
  normalizeUrl,
  normalizeYear,
} from "../../src/shared/metadata.js";

describe("shared constants", () => {
  test("exports the metadata protocol limits", () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(FRAGMENT_PREFIX).toBe("#zotero-ablesci=");
    expect(PAYLOAD_TTL_MS).toBe(30 * 60 * 1000);
    expect(MAX_LENGTHS).toEqual({
      title: 1000,
      doi: 300,
      author: 300,
      publicationTitle: 500,
      year: 4,
      url: 2000,
      zoteroKey: 32,
      itemType: 64,
    });
  });
});

describe("metadata normalization", () => {
  test("collapses whitespace, trims fields, and bounds their lengths", () => {
    const result = normalizeMetadata({
      title: `  ${"T".repeat(1100)} \n extra  `,
      doi: `doi:10.1234/${"D".repeat(400)}`,
      authors: [`  ${"A".repeat(350)}  `],
      publicationTitle: `  ${"J".repeat(550)}  `,
      year: "Published in 2024",
      url: `https://example.com/${"u".repeat(2100)}`,
      zoteroKey: ` ${"K".repeat(40)} `,
      itemType: ` ${"I".repeat(80)} `,
    });

    expect(result.title).toHaveLength(MAX_LENGTHS.title);
    expect(result.doi).toHaveLength(MAX_LENGTHS.doi);
    expect(result.authors[0]).toHaveLength(MAX_LENGTHS.author);
    expect(result.publicationTitle).toHaveLength(MAX_LENGTHS.publicationTitle);
    expect(result.year).toBe("2024");
    expect(result.url).toHaveLength(MAX_LENGTHS.url);
    expect(result.zoteroKey).toHaveLength(MAX_LENGTHS.zoteroKey);
    expect(result.itemType).toHaveLength(MAX_LENGTHS.itemType);
  });

  test("requires a non-empty normalized title", () => {
    expect(() => normalizeMetadata({ title: " \n\t " })).toThrow(
      "TITLE_REQUIRED",
    );
  });

  test("does not leave trailing whitespace when bounding a value", () => {
    const title = `${"A".repeat(MAX_LENGTHS.title - 1)}  B`;

    expect(normalizeMetadata({ title }).title).toBe("A".repeat(999));
  });

  test.each([
    ["doi: 10.1000/ABC.Def", "10.1000/abc.def"],
    ["https://doi.org/10.55555/Some-ID", "10.55555/some-id"],
    ["http://dx.doi.org/10.1234/X_Y", "10.1234/x_y"],
    ["https://example.com/10.1234/no", ""],
    ["10.123/no", ""],
    ["not a doi", ""],
  ])("normalizes DOI %s", (input, expected) => {
    expect(normalizeDoi(input)).toBe(expected);
  });

  test.each([
    [" https://Example.com/a b?x=1 ", "https://example.com/a%20b?x=1"],
    ["http://example.com", "http://example.com/"],
    ["ftp://example.com/file", ""],
    ["javascript:alert(1)", ""],
    ["not a url", ""],
  ])("normalizes URL %s", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  test.each([
    ["Published online 2024", "2024"],
    ["1799 / 2020", "2020"],
    ["2200", ""],
    [2026, "2026"],
    [null, ""],
  ])("extracts a supported year from %s", (input, expected) => {
    expect(normalizeYear(input)).toBe(expected);
  });

  test("filters empty authors, normalizes values, and limits the list to 100", () => {
    const authors = [null, " ", 42, ...Array.from({ length: 105 }, (_, i) => ` Author   ${i} `)];

    const result = normalizeMetadata({ title: "Paper", authors });

    expect(result.authors).toHaveLength(100);
    expect(result.authors[0]).toBe("Author 0");
    expect(result.authors[99]).toBe("Author 99");
  });

  test("returns a complete normalized shape for omitted optional fields", () => {
    expect(normalizeMetadata({ title: " Paper " })).toEqual({
      title: "Paper",
      doi: "",
      authors: [],
      publicationTitle: "",
      year: "",
      url: "",
      zoteroKey: "",
      itemType: "",
    });
  });
});
