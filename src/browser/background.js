import {
  createSessionStore,
  handleSessionMessage,
} from "./session-store.js";

if (globalThis.chrome?.runtime?.onMessage && globalThis.chrome?.storage?.session) {
  const store = createSessionStore(globalThis.chrome.storage.session);
  globalThis.chrome.runtime.onMessage.addListener((message) =>
    handleSessionMessage(message, store),
  );
}
