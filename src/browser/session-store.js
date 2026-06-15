const DEFAULT_KEY = "ablesciPendingTask";

export function createSessionStore(storageArea, key = DEFAULT_KEY) {
  return {
    async save(task) {
      await storageArea.set({ [key]: task });
    },

    async load() {
      const values = await storageArea.get(key);
      return values[key] ?? null;
    },

    async clear() {
      await storageArea.remove(key);
    },
  };
}

export async function handleSessionMessage(message, store) {
  if (
    ![
      "ABLESCI_TASK_SAVE",
      "ABLESCI_TASK_LOAD",
      "ABLESCI_TASK_CLEAR",
    ].includes(message?.type)
  ) {
    return undefined;
  }

  try {
    if (message.type === "ABLESCI_TASK_SAVE") {
      await store.save(message.task);
      return { ok: true };
    }
    if (message.type === "ABLESCI_TASK_LOAD") {
      return { ok: true, value: await store.load() };
    }
    await store.clear();
    return { ok: true };
  } catch {
    return { ok: false, error: "SESSION_STORE_FAILED" };
  }
}
