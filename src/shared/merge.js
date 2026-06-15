const FIELDS = [
  "title",
  "doi",
  "authors",
  "publicationTitle",
  "year",
  "url",
];

function comparable(field, value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  const normalized = text.trim().replace(/\s+/gu, " ");
  return field === "doi" ? normalized.toLowerCase() : normalized;
}

export function mergeFormValues(siteValues = {}, zoteroValues = {}) {
  const values = {};
  const conflicts = [];

  for (const field of FIELDS) {
    const site = siteValues[field] ?? "";
    const zotero = zoteroValues[field] ?? "";
    const comparableSite = comparable(field, site);
    const comparableZotero = comparable(field, zotero);

    values[field] = comparableSite ? site : zotero;

    if (
      comparableSite &&
      comparableZotero &&
      comparableSite !== comparableZotero
    ) {
      conflicts.push({ field, site, zotero });
    }
  }

  return { values, conflicts };
}
