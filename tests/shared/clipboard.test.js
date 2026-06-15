import { describe, expect, test } from "vitest";

import { formatMetadataText } from "../../src/shared/clipboard.js";

describe("clipboard metadata formatting", () => {
  test("formats normalized metadata with Chinese labels", () => {
    expect(
      formatMetadataText({
        title: "  A   Paper ",
        doi: "DOI:10.1234/ABC",
        authors: [" Alice ", "Bob"],
        publicationTitle: " Journal ",
        year: "Published 2024",
        url: "https://example.com/paper",
      }),
    ).toBe(
      [
        "标题：A Paper",
        "DOI：10.1234/abc",
        "作者：Alice；Bob",
        "期刊：Journal",
        "年份：2024",
        "官方链接：https://example.com/paper",
      ].join("\n"),
    );
  });

  test("omits empty optional fields", () => {
    expect(formatMetadataText({ title: "Paper" })).toBe("标题：Paper");
  });

  test("requires a title through metadata normalization", () => {
    expect(() => formatMetadataText({ title: " " })).toThrow("TITLE_REQUIRED");
  });
});
