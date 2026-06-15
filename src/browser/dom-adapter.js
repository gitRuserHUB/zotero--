import {
  FIELD_SELECTORS,
  QUERY_ERROR_SELECTORS,
  QUERY_SELECTORS,
} from "./selectors.js";

const FIELDS = Object.keys(FIELD_SELECTORS);

function isVisible(element) {
  return Boolean(
    element &&
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getAttribute("type") !== "hidden" &&
      element.style?.display !== "none" &&
      element.style?.visibility !== "hidden",
  );
}

function resolveField(document, field) {
  for (const selector of FIELD_SELECTORS[field]) {
    const matches = [...document.querySelectorAll(selector)].filter(isVisible);
    if (matches.length > 1) throw new Error(`AMBIGUOUS_FIELD:${field}`);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function resolveQueryButton(document) {
  for (const selector of QUERY_SELECTORS) {
    let matches = [...document.querySelectorAll(selector)].filter(isVisible);
    if (selector === 'button[type="button"]') {
      matches = matches.filter((button) => button.textContent.trim() === "查询");
    }
    if (matches.length > 1) throw new Error("AMBIGUOUS_DOI_QUERY_CONTROL");
    if (matches.length === 1) return matches[0];
  }
  throw new Error("DOI_QUERY_CONTROL_NOT_FOUND");
}

function visibleQueryError(document) {
  for (const selector of QUERY_ERROR_SELECTORS) {
    const match = [...document.querySelectorAll(selector)].find(
      (element) => isVisible(element) && element.textContent.trim(),
    );
    if (match) return match.textContent.trim();
  }
  return "";
}

function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function writeValue(document, element, value) {
  setNativeValue(element, value);
  const Event = document.defaultView?.Event ?? globalThis.Event;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function formValue(field, value) {
  if (field === "authors" && Array.isArray(value)) return value.join("；");
  return String(value ?? "");
}

export function createAbleSciAdapter(document) {
  function readValues() {
    return Object.fromEntries(
      FIELDS.map((field) => [field, resolveField(document, field)?.value ?? ""]),
    );
  }

  function writeEmptyFields(values) {
    for (const field of FIELDS) {
      const element = resolveField(document, field);
      const nextValue = formValue(field, values[field]);
      if (element && !element.value.trim() && nextValue.trim()) {
        writeValue(document, element, nextValue);
      }
    }
  }

  async function queryDoi(doi, { timeoutMs = 10_000, pollMs = 50 } = {}) {
    const doiInput = resolveField(document, "doi");
    if (!doiInput) throw new Error("FIELD_NOT_FOUND:doi");
    const queryButton = resolveQueryButton(document);
    const before = JSON.stringify({ ...readValues(), doi: "" });
    writeValue(document, doiInput, doi);

    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(interval);
        observer.disconnect();
        callback(value);
      };
      const check = () => {
        if (visibleQueryError(document)) {
          finish(reject, new Error("DOI_QUERY_FAILED"));
          return;
        }
        const after = JSON.stringify({ ...readValues(), doi: "" });
        if (after !== before) finish(resolve);
      };
      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      const interval = setInterval(check, pollMs);
      const timeout = setTimeout(
        () => finish(reject, new Error("DOI_QUERY_TIMEOUT")),
        timeoutMs,
      );
      queryButton.click();
      check();
    });
  }

  return {
    isLoginPage: () => Boolean(document.querySelector('input[type="password"]')),
    isCreatePage: () => Boolean(resolveField(document, "doi") || resolveField(document, "title")),
    readValues,
    writeEmptyFields,
    queryDoi,
  };
}
