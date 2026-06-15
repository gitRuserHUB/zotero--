import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function expectedArtifactEntries() {
  return {
    zotero: ["manifest.json", "bootstrap.js", "ablesci-assistant.js", "icon.svg"],
    chromium: ["manifest.json", "background.js", "content.js", "status-panel.css"],
  };
}

export async function verifyStagedArtifacts(root = process.cwd()) {
  const invalid = [];

  for (const [target, entries] of Object.entries(expectedArtifactEntries())) {
    for (const entry of entries) {
      const artifactPath = path.join(root, "dist", target, entry);
      const relativePath = path.relative(root, artifactPath);

      try {
        const stats = await fs.stat(artifactPath);

        if (!stats.isFile()) {
          invalid.push(`${relativePath} (not a regular file)`);
        } else if (stats.size === 0) {
          invalid.push(`${relativePath} (empty file)`);
        }
      } catch (error) {
        const reason = error.code === "ENOENT" ? "missing" : error.message;
        invalid.push(`${relativePath} (${reason})`);
      }
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Invalid staged artifacts:\n${invalid.join("\n")}`);
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  await verifyStagedArtifacts();
  console.log("Artifact verification passed");
}
