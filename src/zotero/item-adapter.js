import { normalizeMetadata } from "../shared/metadata.js";

export function validateSelection(items) {
  if (!items?.length) throw new Error("NO_SELECTION");
  if (items.length !== 1) throw new Error("MULTIPLE_SELECTION");
  if (!items[0].isRegularItem?.()) throw new Error("REGULAR_ITEM_REQUIRED");
  return items[0];
}

function creatorTypeName(creator) {
  if (typeof creator.creatorType === "string") return creator.creatorType;
  try {
    return globalThis.Zotero?.CreatorTypes?.getName?.(creator.creatorTypeID) ?? "";
  } catch {
    return "";
  }
}

function isAuthor(creator) {
  const type = creatorTypeName(creator);
  return type ? type === "author" : creator.creatorTypeID === 1;
}

function creatorName(creator) {
  if (creator.name) return creator.name;
  return [creator.lastName, creator.firstName].filter(Boolean).join(", ");
}

function itemTypeName(item) {
  if (typeof item.itemType === "string") return item.itemType;
  try {
    return globalThis.Zotero?.ItemTypes?.getName?.(item.itemTypeID) ?? "";
  } catch {
    return "";
  }
}

export function extractMetadata(item) {
  return normalizeMetadata({
    zoteroKey: item.key,
    itemType: itemTypeName(item),
    title: item.getField("title"),
    doi: item.getField("DOI"),
    authors: item.getCreators().filter(isAuthor).map(creatorName),
    publicationTitle:
      item.getField("publicationTitle") ||
      item.getField("bookTitle") ||
      item.getField("proceedingsTitle"),
    year: item.getField("date"),
    url: item.getField("url"),
  });
}

function endsWithPdf(value) {
  const path = String(value ?? "").split(/[?#]/u, 1)[0];
  return path.toLowerCase().endsWith(".pdf");
}

function looksLikePdf(attachment) {
  if (attachment.attachmentContentType?.toLowerCase() === "application/pdf") {
    return true;
  }

  return [
    attachment.getField?.("url"),
    attachment.getField?.("path"),
    attachment.attachmentPath,
    attachment.attachmentFilename,
  ].some(endsWithPdf);
}

export async function hasPdfAttachment(item, { getByID }) {
  for (const id of item.getAttachments()) {
    const attachment = await getByID(id);
    if (attachment && looksLikePdf(attachment)) return true;
  }
  return false;
}
