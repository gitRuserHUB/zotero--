import {
  FIELD_SELECTORS,
  QUERY_ERROR_SELECTORS,
  QUERY_SELECTORS,
} from "./selectors.js";

const FIELDS = Object.keys(FIELD_SELECTORS);
const LABEL_PATTERNS = Object.freeze({
  doi: [/doi/i],
  title: [/标题/u, /题名/u, /文献名/u, /文名/u],
  authors: [/作者/u, /著者/u, /author/i],
  publicationTitle: [/期刊/u, /刊名/u, /杂志/u, /journal/i],
  year: [/年份/u, /发表年/u, /出版年/u, /^年$/u, /year/i],
  url: [/官网/u, /链接/u, /网址/u, /\burl\b/i, /原文/u],
  otherInfo: [/其他信息/u, /补充信息/u, /备注/u],
});
const QUERY_CONTEXT_PATTERN = /一键求助|科研通AI|智能提取|PMID/u;
const CONTROL_SELECTOR =
  'input:not([type="hidden"]), textarea, select, [contenteditable="true"]';

function isVisible(element) {
  for (let current = element; current; current = current.parentElement) {
    if (
      current.hidden ||
      current.getAttribute("aria-hidden") === "true" ||
      current.style?.display === "none" ||
      current.style?.visibility === "hidden"
    ) {
      return false;
    }
  }

  return Boolean(element && element.getAttribute("type") !== "hidden");
}

function unique(elements) {
  return [...new Set(elements)];
}

function textOf(element) {
  return String(element?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

function labelMatches(field, text) {
  return LABEL_PATTERNS[field].some((pattern) => pattern.test(text));
}

function quotedAttributeValue(value) {
  return String(value).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

function fieldLabels(document, element) {
  const labels = [];
  if (element.labels) labels.push(...element.labels);
  const wrappingLabel = element.closest?.("label");
  if (wrappingLabel) labels.push(wrappingLabel);

  const id = element.getAttribute("id");
  if (id) {
    labels.push(
      ...document.querySelectorAll(`label[for="${quotedAttributeValue(id)}"]`),
    );
  }

  const fieldRow = element.closest(
    ".layui-form-item, .form-group, .form-item, .field, tr",
  );
  if (fieldRow) {
    labels.push(
      ...fieldRow.querySelectorAll(
        ".layui-form-label, .control-label, .form-label, label, th, dt",
      ),
    );
  }

  return unique(labels).map(textOf).join(" ");
}

function nearestFieldGroup(element) {
  return (
    element.closest("form") ??
    element.closest("[data-page], main, section, article") ??
    element.ownerDocument?.body
  );
}

function fieldContextText(element) {
  return textOf(
    element.closest(".layui-form-item, .form-group, .form-item, .field, tr") ??
      element.parentElement,
  );
}

function fieldGroupScore(document, element) {
  const group = nearestFieldGroup(element);
  if (!group) return 0;

  let score = 0;
  for (const field of FIELDS) {
    const controls = [
      ...group.querySelectorAll(CONTROL_SELECTOR),
    ].filter((control) => labelMatches(field, fieldLabels(document, control)));
    if (controls.length > 0) score += 10;
  }
  return score;
}

function fieldScore(document, field, element) {
  const labelText = fieldLabels(document, element);
  const contextText = fieldContextText(element);
  const placeholder = element.getAttribute("placeholder") ?? "";
  const ariaLabel = element.getAttribute("aria-label") ?? "";
  const name = element.getAttribute("name") ?? "";
  const id = element.getAttribute("id") ?? "";

  let score = fieldGroupScore(document, element);
  if (labelMatches(field, labelText)) score += 100;
  if (labelMatches(field, contextText)) score += 40;
  if (labelMatches(field, `${placeholder} ${ariaLabel}`)) score += 20;
  if (labelMatches(field, `${name} ${id}`)) score += 5;
  if (element.closest("form")) score += 1;
  if (QUERY_CONTEXT_PATTERN.test(contextText)) score -= 100;
  return score;
}

function selectBestField(document, field, candidates) {
  const scored = unique(candidates)
    .filter(isVisible)
    .map((element, index) => ({
      element,
      index,
      score: fieldScore(document, field, element),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (scored.length === 0) return null;
  if (scored.length === 1 || scored[0].score > scored[1].score) {
    return scored[0].element;
  }
  throw new Error(`AMBIGUOUS_FIELD:${field}`);
}

function labelControl(document, label) {
  if (label.control) return label.control;
  const forID = label.getAttribute("for");
  if (forID) return document.getElementById(forID);
  const nestedControl = label.querySelector(CONTROL_SELECTOR);
  if (nestedControl) return nestedControl;
  return label
    .closest(".layui-form-item, .form-group, .form-item, .field, tr")
    ?.querySelector(CONTROL_SELECTOR);
}

function labelCandidates(document, field) {
  const controls = [];
  for (const label of [...document.querySelectorAll("label")].filter(isVisible)) {
    if (labelMatches(field, textOf(label))) {
      const control = labelControl(document, label);
      if (control && isVisible(control)) controls.push(control);
    }
  }
  return controls;
}

function resolveFieldByLabel(document, field) {
  return selectBestField(document, field, labelCandidates(document, field));
}

function resolveField(document, field) {
  const candidates = [];
  for (const selector of FIELD_SELECTORS[field]) {
    candidates.push(...document.querySelectorAll(selector));
  }
  candidates.push(...labelCandidates(document, field));
  return selectBestField(document, field, candidates);
}

function resolveQueryButton(document) {
  for (const selector of QUERY_SELECTORS) {
    let matches = [...document.querySelectorAll(selector)].filter(isVisible);
    if (selector.includes("button") || selector.includes("role")) {
      matches = matches.filter((button) => {
        const text = textOf(button);
        return (
          /查询|检索|搜索|获取|智能提取|提取文献/u.test(text) &&
          !/发布|提交|求助$/u.test(text)
        );
      });
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

function resolveQueryInput(document) {
  const candidates = [
    ...document.querySelectorAll(
      [
        '[data-testid="doi-query-input"]',
        'input[name="doi-query"]',
        'input[placeholder*="PMID" i]',
        'input[placeholder*="DOI" i]',
      ].join(","),
    ),
  ].filter(isVisible);

  const preferred = candidates.filter((element) =>
    QUERY_CONTEXT_PATTERN.test(`${fieldContextText(element)} ${element.placeholder ?? ""}`),
  );
  if (preferred.length === 1) return preferred[0];
  if (preferred.length > 1) throw new Error("AMBIGUOUS_DOI_QUERY_FIELD");
  return resolveField(document, "doi");
}

function setNativeValue(element, value) {
  if (element.isContentEditable) {
    element.textContent = value;
    return;
  }
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function getNativeValue(element) {
  return element?.isContentEditable ? element.textContent : element?.value ?? "";
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

function supplementalInfo(values) {
  const lines = [];
  const authors = formValue("authors", values.authors);
  const publicationTitle = formValue(
    "publicationTitle",
    values.publicationTitle,
  );
  const year = formValue("year", values.year);

  if (authors.trim()) lines.push(`作者：${authors}`);
  if (publicationTitle.trim()) lines.push(`期刊：${publicationTitle}`);
  if (year.trim()) lines.push(`年份：${year}`);
  return lines.join("\n");
}

export function createAbleSciAdapter(document) {
  function readValues() {
    return Object.fromEntries(
      FIELDS.map((field) => {
        const element = resolveField(document, field);
        return [field, getNativeValue(element)];
      }),
    );
  }

  function writeEmptyFields(values) {
    for (const field of FIELDS) {
      const element = resolveField(document, field);
      const nextValue = formValue(field, values[field]);
      if (element && !getNativeValue(element).trim() && nextValue.trim()) {
        writeValue(document, element, nextValue);
      }
    }

    const otherInfo = resolveFieldByLabel(document, "otherInfo");
    const otherValue = supplementalInfo(values);
    if (otherInfo && !getNativeValue(otherInfo).trim() && otherValue.trim()) {
      writeValue(document, otherInfo, otherValue);
    }
  }

  async function queryDoi(doi, { timeoutMs = 10_000, pollMs = 50 } = {}) {
    const doiInput = resolveQueryInput(document);
    if (!doiInput) throw new Error("FIELD_NOT_FOUND:doi");
    const queryButton = resolveQueryButton(document);
    const before = JSON.stringify({ ...readValues(), doi: "" });
    writeValue(document, doiInput, doi);

    await new Promise((resolve, reject) => {
      let settled = false;
      let observer;
      let interval;
      let timeout;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(interval);
        observer?.disconnect();
        callback(value);
      };
      const check = () => {
        if (settled) return;
        try {
          if (visibleQueryError(document)) {
            finish(reject, new Error("DOI_QUERY_FAILED"));
            return;
          }
          const after = JSON.stringify({ ...readValues(), doi: "" });
          if (after !== before) finish(resolve);
        } catch (error) {
          finish(reject, error);
        }
      };
      observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      interval = setInterval(check, pollMs);
      timeout = setTimeout(
        () => finish(reject, new Error("DOI_QUERY_TIMEOUT")),
        timeoutMs,
      );
      try {
        queryButton.click();
        check();
      } catch (error) {
        finish(reject, error);
      }
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
