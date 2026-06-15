export function createSessionClient(
  sendMessage = (message) => globalThis.chrome.runtime.sendMessage(message),
) {
  async function request(message) {
    try {
      const response = await sendMessage(message);
      if (!response?.ok) throw new Error("SESSION_STORE_FAILED");
      return response.value;
    } catch {
      throw new Error("SESSION_STORE_FAILED");
    }
  }

  return {
    save: (task) => request({ type: "ABLESCI_TASK_SAVE", task }),
    load: () => request({ type: "ABLESCI_TASK_LOAD" }),
    clear: () => request({ type: "ABLESCI_TASK_CLEAR" }),
  };
}
