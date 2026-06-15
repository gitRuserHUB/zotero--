var AbleSciAssistant;

async function startup({ id, version, rootURI }) {
  await Zotero.initializationPromise;
  Services.scriptloader.loadSubScript(rootURI + "ablesci-assistant.js");
  AbleSciAssistant.init({ id, version, rootURI });
  AbleSciAssistant.addToAllWindows();
}

function onMainWindowLoad({ window }) {
  AbleSciAssistant.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  AbleSciAssistant.removeFromWindow(window);
}

function shutdown() {
  AbleSciAssistant?.removeFromAllWindows();
  AbleSciAssistant = undefined;
}

function install() {}
function uninstall() {}
