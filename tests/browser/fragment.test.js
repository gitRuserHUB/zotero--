// @vitest-environment jsdom

import { expect, test, vi } from "vitest";

import { consumeFragment } from "../../src/browser/fragment.js";

test("decodes and immediately removes an AbleSci handoff fragment", () => {
  history.replaceState({}, "", "/assist/create#zotero-ablesci=encoded");
  const replaceState = vi.spyOn(history, "replaceState");

  const payload = consumeFragment({
    decode: () => ({ v: 1, item: { title: "Paper" } }),
  });

  expect(payload.item.title).toBe("Paper");
  expect(replaceState).toHaveBeenCalled();
  expect(location.hash).toBe("");
});

test("removes a malformed recognized fragment before rethrowing", () => {
  history.replaceState({}, "", "/assist/create?from=zotero#zotero-ablesci=bad");

  expect(() =>
    consumeFragment({
      decode: () => {
        throw new Error("PAYLOAD_MALFORMED");
      },
    }),
  ).toThrow("PAYLOAD_MALFORMED");
  expect(location.pathname + location.search).toBe(
    "/assist/create?from=zotero",
  );
  expect(location.hash).toBe("");
});

test("ignores unrelated fragments without changing the URL", () => {
  history.replaceState({}, "", "/assist/create#section-2");
  const replaceState = vi.spyOn(history, "replaceState");

  expect(consumeFragment({ decode: vi.fn() })).toBeNull();
  expect(replaceState).not.toHaveBeenCalled();
  expect(location.hash).toBe("#section-2");
});
