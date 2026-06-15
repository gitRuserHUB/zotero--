import { MAX_LENGTHS } from "./constants.js";

function normalizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/gu, " ").trim().slice(0, maxLength).trimEnd();
}

export function normalizeDoi(value) {
  const doi = normalizeText(value, Number.MAX_SAFE_INTEGER)
    .replace(/^doi:\s*/iu, "")
    .replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//iu, "")
    .toLowerCase()
    .slice(0, MAX_LENGTHS.doi);

  return /^10\.\d{4,9}\/\S+$/u.test(doi) ? doi : "";
}

export function normalizeUrl(value) {
  const candidate = normalizeText(value, MAX_LENGTHS.url);
  if (!candidate) {
    return "";
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.href.slice(0, MAX_LENGTHS.url);
  } catch {
    return "";
  }
}

export function normalizeYear(value) {
  const candidate =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const match = candidate.match(/(?:18|19|20|21)\d{2}/u);
  return match ? match[0].slice(0, MAX_LENGTHS.year) : "";
}

export function normalizeMetadata(item) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const title = normalizeText(source.title, MAX_LENGTHS.title);
  if (!title) {
    throw new Error("TITLE_REQUIRED");
  }

  const authors = [];
  if (Array.isArray(source.authors)) {
    for (const author of source.authors) {
      const normalized = normalizeText(author, MAX_LENGTHS.author);
      if (normalized) {
        authors.push(normalized);
      }
      if (authors.length === 100) {
        break;
      }
    }
  }

  return {
    title,
    doi: normalizeDoi(source.doi),
    authors,
    publicationTitle: normalizeText(
      source.publicationTitle,
      MAX_LENGTHS.publicationTitle,
    ),
    year: normalizeYear(source.year),
    url: normalizeUrl(source.url),
    zoteroKey: normalizeText(source.zoteroKey, MAX_LENGTHS.zoteroKey),
    itemType: normalizeText(source.itemType, MAX_LENGTHS.itemType),
  };
}
