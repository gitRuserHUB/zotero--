import { afterEach, describe, expect, test } from "vitest";

import {
  FRAGMENT_PREFIX,
  PAYLOAD_TTL_MS,
  PROTOCOL_VERSION,
} from "../../src/shared/constants.js";
import {
  buildPayload,
  decodeFragment,
  encodeFragment,
} from "../../src/shared/payload.js";

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);
const originalBuffer = globalThis.Buffer;

function encodedRaw(value) {
  return `${FRAGMENT_PREFIX}${Buffer.from(value, "utf8").toString("base64url")}`;
}

afterEach(() => {
  globalThis.Buffer = originalBuffer;
});

describe("metadata payload protocol", () => {
  test("builds a normalized versioned payload with an injected nonce", () => {
    expect(
      buildPayload(
        { title: "  A   Paper ", doi: "DOI:10.1234/ABC" },
        { now: NOW, nonce: "fixed-nonce" },
      ),
    ).toEqual({
      v: PROTOCOL_VERSION,
      createdAt: NOW,
      nonce: "fixed-nonce",
      item: {
        title: "A Paper",
        doi: "10.1234/abc",
        authors: [],
        publicationTitle: "",
        year: "",
        url: "",
        zoteroKey: "",
        itemType: "",
      },
    });
  });

  test.each([undefined, null, "", "   "])(
    "rejects an explicitly invalid nonce: %s",
    (nonce) => {
      expect(() => buildPayload({ title: "Paper" }, { now: NOW, nonce })).toThrow(
        "PAYLOAD_NONCE_REQUIRED",
      );
    },
  );

  test("uses a production nonce fallback when options omit nonce", () => {
    const payload = buildPayload({ title: "Paper" }, { now: NOW });

    expect(payload.nonce).toEqual(expect.any(String));
    expect(payload.nonce.length).toBeGreaterThan(0);
  });

  test("rejects a non-finite explicit build timestamp", () => {
    expect(() =>
      buildPayload({ title: "Paper" }, { now: null, nonce: "nonce" }),
    ).toThrow("PAYLOAD_MALFORMED");
  });

  test("encodes the exact prefix and round-trips Unicode metadata", () => {
    const payload = buildPayload(
      {
        title: "肿瘤免疫研究 αβ",
        authors: ["张三", "María García"],
        publicationTitle: "科学期刊",
      },
      { now: NOW, nonce: "中文-nonce" },
    );

    const fragment = encodeFragment(payload);

    expect(fragment.startsWith(FRAGMENT_PREFIX)).toBe(true);
    expect(decodeFragment(fragment, { now: NOW })).toEqual(payload);
  });

  test("supports browser UTF-8 and Base64 APIs when Buffer is unavailable", () => {
    const payload = buildPayload(
      { title: "浏览器 Unicode" },
      { now: NOW, nonce: "browser" },
    );
    globalThis.Buffer = undefined;

    const fragment = encodeFragment(payload);

    expect(decodeFragment(fragment, { now: NOW })).toEqual(payload);
  });

  test("requires the exact fragment prefix", () => {
    expect(() => decodeFragment("zotero-ablesci=abc", { now: NOW })).toThrow(
      "PAYLOAD_PREFIX_INVALID",
    );
    expect(() => decodeFragment(`${FRAGMENT_PREFIX}abc#extra`, { now: NOW })).toThrow(
      "PAYLOAD_MALFORMED",
    );
  });

  test.each([
    [`${FRAGMENT_PREFIX}%%%`, "invalid Base64URL"],
    [encodedRaw("not-json"), "invalid JSON"],
    [encodedRaw("null"), "non-object JSON"],
    [encodeFragment([]), "array JSON"],
  ])("rejects malformed payloads with %s", (fragment) => {
    expect(() => decodeFragment(fragment, { now: NOW })).toThrow(
      "PAYLOAD_MALFORMED",
    );
  });

  test("rejects unsupported protocol versions", () => {
    const fragment = encodeFragment({
      v: 2,
      createdAt: NOW,
      nonce: "nonce",
      item: { title: "Paper" },
    });

    expect(() => decodeFragment(fragment, { now: NOW })).toThrow(
      "PAYLOAD_VERSION_UNSUPPORTED",
    );
  });

  test("rejects expired payloads", () => {
    const fragment = encodeFragment(
      buildPayload(
        { title: "Paper" },
        { now: NOW - PAYLOAD_TTL_MS - 1, nonce: "nonce" },
      ),
    );

    expect(() => decodeFragment(fragment, { now: NOW })).toThrow(
      "PAYLOAD_EXPIRED",
    );
  });

  test("rejects payloads more than five minutes in the future", () => {
    const fragment = encodeFragment(
      buildPayload(
        { title: "Paper" },
        { now: NOW + 5 * 60 * 1000 + 1, nonce: "nonce" },
      ),
    );

    expect(() => decodeFragment(fragment, { now: NOW })).toThrow(
      "PAYLOAD_FROM_FUTURE",
    );
  });

  test("rejects a non-finite explicit decode timestamp", () => {
    const fragment = encodeFragment(
      buildPayload({ title: "Paper" }, { now: NOW, nonce: "nonce" }),
    );

    expect(() => decodeFragment(fragment, { now: null })).toThrow(
      "PAYLOAD_MALFORMED",
    );
  });

  test.each([
    [{ v: 1, createdAt: "now", nonce: "n", item: { title: "Paper" } }, "createdAt"],
    [{ v: 1, createdAt: NOW, nonce: "n", item: null }, "null item"],
    [{ v: 1, createdAt: NOW, nonce: "n", item: [] }, "array item"],
  ])("rejects an invalid payload shape: %s", (payload) => {
    expect(() => decodeFragment(encodeFragment(payload), { now: NOW })).toThrow(
      "PAYLOAD_MALFORMED",
    );
  });

  test.each([
    [{ v: 1, createdAt: NOW, item: { title: "Paper" } }, "missing nonce"],
    [{ v: 1, createdAt: NOW, nonce: 123, item: { title: "Paper" } }, "nonce type"],
    [{ v: 1, createdAt: NOW, nonce: " ", item: { title: "Paper" } }, "empty nonce"],
  ])("rejects a payload with %s", (payload) => {
    expect(() => decodeFragment(encodeFragment(payload), { now: NOW })).toThrow(
      "PAYLOAD_NONCE_REQUIRED",
    );
  });

  test("re-normalizes decoded item metadata", () => {
    const fragment = encodeFragment({
      v: 1,
      createdAt: NOW,
      nonce: "nonce",
      item: { title: " A   Paper ", url: "ftp://example.com" },
    });

    expect(decodeFragment(fragment, { now: NOW }).item).toMatchObject({
      title: "A Paper",
      url: "",
    });
  });
});
