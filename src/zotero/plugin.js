import { formatMetadataText } from "../shared/clipboard.js";
import { buildPayload, encodeFragment } from "../shared/payload.js";
import { createRequestCommand } from "./command.js";
import {
  extractMetadata,
  hasPdfAttachment,
  validateSelection,
} from "./item-adapter.js";
import { addWindowUi, removeWindowUi } from "./ui.js";

function createNotifier(Zotero) {
  return (level, message) => {
    const progress = new Zotero.ProgressWindow();
    progress.changeHeadline("科研通求助");
    progress.addDescription(message);
    progress.show();
    Zotero.debug?.(`[AbleSci Assistant] ${level}`);
  };
}

function createNonce() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function createPluginRuntime(
  Zotero,
  { commandFactory = createRequestCommand } = {},
) {
  let config;

  function requireConfig() {
    if (!config) throw new Error("PLUGIN_NOT_INITIALIZED");
    return config;
  }

  function createWindowCommand(window) {
    const getItemByID = (id) => Zotero.Items.getAsync(id);
    return commandFactory({
      getSelectedItems: () => window.ZoteroPane.getSelectedItems(),
      getItemByID,
      validateSelection,
      hasPdfAttachment: (item) => hasPdfAttachment(item, { getByID: getItemByID }),
      extractMetadata,
      buildPayload,
      encodeFragment,
      formatMetadataText,
      writeClipboard: (text) =>
        Zotero.Utilities.Internal.copyTextToClipboard(text),
      openUrl: (url) => Zotero.launchURL(url),
      notify: createNotifier(Zotero),
      now: () => Date.now(),
      nonce: createNonce,
    });
  }

  return {
    init(nextConfig) {
      config = { ...nextConfig };
    },

    addToWindow(window) {
      const { rootURI } = requireConfig();
      addWindowUi(window, {
        onCommand: createWindowCommand(window),
        iconUrl: `${rootURI}icon.svg`,
      });
    },

    addToAllWindows() {
      requireConfig();
      for (const window of Zotero.getMainWindows()) this.addToWindow(window);
    },

    removeFromWindow(window) {
      removeWindowUi(window);
    },

    removeFromAllWindows() {
      for (const window of Zotero.getMainWindows()) this.removeFromWindow(window);
    },
  };
}

export const AbleSciAssistant = createPluginRuntime(globalThis.Zotero);
globalThis.AbleSciAssistant = AbleSciAssistant;
