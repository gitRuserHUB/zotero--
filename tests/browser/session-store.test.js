import { describe, expect, test, vi } from "vitest";

import {
  createSessionStore,
  handleSessionMessage,
} from "../../src/browser/session-store.js";
import { createSessionClient } from "../../src/browser/session-client.js";

function memoryArea() {
  const data = {};
  return {
    data,
    set: vi.fn(async (value) => Object.assign(data, value)),
    get: vi.fn(async (key) => ({ [key]: data[key] })),
    remove: vi.fn(async (key) => delete data[key]),
  };
}

describe("session task store", () => {
  test("stores, retrieves, and clears a pending task", async () => {
    const area = memoryArea();
    const store = createSessionStore(area);

    await store.save({ nonce: "n-1" });
    expect(await store.load()).toEqual({ nonce: "n-1" });
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  test("handles only the three documented runtime messages", async () => {
    const store = createSessionStore(memoryArea());
    expect(
      await handleSessionMessage(
        { type: "ABLESCI_TASK_SAVE", task: { nonce: "n" } },
        store,
      ),
    ).toEqual({ ok: true });
    expect(
      await handleSessionMessage({ type: "ABLESCI_TASK_LOAD" }, store),
    ).toEqual({ ok: true, value: { nonce: "n" } });
    expect(
      await handleSessionMessage({ type: "ABLESCI_TASK_CLEAR" }, store),
    ).toEqual({ ok: true });
    expect(
      await handleSessionMessage({ type: "UNKNOWN" }, store),
    ).toBeUndefined();
  });

  test("returns a metadata-free failure response", async () => {
    const store = {
      save: async () => {
        throw new Error("secret title");
      },
    };
    expect(
      await handleSessionMessage(
        { type: "ABLESCI_TASK_SAVE", task: { title: "secret title" } },
        store,
      ),
    ).toEqual({ ok: false, error: "SESSION_STORE_FAILED" });
  });
});

describe("content-script session client", () => {
  test("translates save, load, and clear calls to runtime messages", async () => {
    const sendMessage = vi.fn(async (message) =>
      message.type === "ABLESCI_TASK_LOAD"
        ? { ok: true, value: { nonce: "n" } }
        : { ok: true },
    );
    const client = createSessionClient(sendMessage);

    await client.save({ nonce: "n" });
    expect(await client.load()).toEqual({ nonce: "n" });
    await client.clear();
    expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
      "ABLESCI_TASK_SAVE",
      "ABLESCI_TASK_LOAD",
      "ABLESCI_TASK_CLEAR",
    ]);
  });

  test("normalizes runtime failures", async () => {
    const rejected = createSessionClient(async () => {
      throw new Error("port closed");
    });
    const failed = createSessionClient(async () => ({ ok: false }));

    await expect(rejected.load()).rejects.toThrow("SESSION_STORE_FAILED");
    await expect(failed.load()).rejects.toThrow("SESSION_STORE_FAILED");
  });
});
