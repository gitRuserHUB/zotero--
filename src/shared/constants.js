export const PROTOCOL_VERSION = 1;
export const FRAGMENT_PREFIX = "#zotero-ablesci=";
export const PAYLOAD_TTL_MS = 30 * 60 * 1000;

export const MAX_LENGTHS = Object.freeze({
  title: 1000,
  doi: 300,
  author: 300,
  publicationTitle: 500,
  year: 4,
  url: 2000,
  zoteroKey: 32,
  itemType: 64,
});
