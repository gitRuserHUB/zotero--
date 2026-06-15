import { normalizeMetadata } from "./metadata.js";

export function formatMetadataText(item) {
  const metadata = normalizeMetadata(item);
  const lines = [`标题：${metadata.title}`];

  if (metadata.doi) lines.push(`DOI：${metadata.doi}`);
  if (metadata.authors.length) lines.push(`作者：${metadata.authors.join("；")}`);
  if (metadata.publicationTitle) lines.push(`期刊：${metadata.publicationTitle}`);
  if (metadata.year) lines.push(`年份：${metadata.year}`);
  if (metadata.url) lines.push(`官方链接：${metadata.url}`);

  return lines.join("\n");
}
