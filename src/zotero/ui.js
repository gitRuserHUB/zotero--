export const TOOLBAR_BUTTON_ID = "ablesci-toolbar-button";
export const ITEM_MENU_ID = "ablesci-item-menu";

function createElement(document, tagName) {
  return document.createXULElement?.(tagName) ?? document.createElement(tagName);
}

function findHosts(document) {
  const toolbar =
    document.querySelector("#zotero-items-toolbar") ??
    document.querySelector("#zotero-tb");
  const itemMenu = document.querySelector("#zotero-itemmenu");
  if (!toolbar || !itemMenu) throw new Error("ZOTERO_UI_HOST_NOT_FOUND");
  return { toolbar, itemMenu };
}

function addCommandListener(element, onCommand) {
  element.addEventListener("command", () => {
    void onCommand();
  });
}

export function addWindowUi(window, { onCommand, iconUrl }) {
  const { document } = window;
  if (
    document.getElementById(TOOLBAR_BUTTON_ID) &&
    document.getElementById(ITEM_MENU_ID)
  ) {
    return;
  }

  const { toolbar, itemMenu } = findHosts(document);

  if (!document.getElementById(TOOLBAR_BUTTON_ID)) {
    const button = createElement(document, "toolbarbutton");
    button.id = TOOLBAR_BUTTON_ID;
    button.setAttribute("label", "科研通求助");
    button.setAttribute("tooltiptext", "在科研通发起文献求助");
    button.setAttribute("image", iconUrl);
    button.setAttribute("class", "zotero-tb-button");
    addCommandListener(button, onCommand);
    toolbar.append(button);
  }

  if (!document.getElementById(ITEM_MENU_ID)) {
    const menuItem = createElement(document, "menuitem");
    menuItem.id = ITEM_MENU_ID;
    menuItem.setAttribute("label", "在科研通发起文献求助");
    menuItem.setAttribute("image", iconUrl);
    menuItem.setAttribute("class", "menuitem-iconic");
    addCommandListener(menuItem, onCommand);
    itemMenu.append(menuItem);
  }
}

export function removeWindowUi(window) {
  window.document.getElementById(TOOLBAR_BUTTON_ID)?.remove();
  window.document.getElementById(ITEM_MENU_ID)?.remove();
}
