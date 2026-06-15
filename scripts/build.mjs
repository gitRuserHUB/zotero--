import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import yazl from "yazl";

import { expectedArtifactEntries } from "./verify-artifacts.mjs";

const { ZipFile } = yazl;

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfPresent(source, destination) {
  if (await exists(source)) {
    await fs.copyFile(source, destination);
  }
}

async function bundleIfPresent(source, destination) {
  if (await exists(source)) {
    await build({
      entryPoints: [source],
      outfile: destination,
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2022",
    });
  }
}

async function hasAllEntries(directory, entries) {
  const present = await Promise.all(
    entries.map((entry) => exists(path.join(directory, entry))),
  );
  return present.every(Boolean);
}

async function createArchive(archivePath, sourceDirectory, entries) {
  await fs.rm(archivePath, { force: true });

  await new Promise((resolve, reject) => {
    const zip = new ZipFile();
    const output = zip.outputStream.pipe(createWriteStream(archivePath));

    output.on("close", resolve);
    output.on("error", reject);
    zip.outputStream.on("error", reject);

    for (const entry of entries) {
      zip.addFile(path.join(sourceDirectory, entry), entry);
    }

    zip.end();
  });
}

export async function buildAll(root = process.cwd()) {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  const distDirectory = path.join(root, "dist");
  const zoteroDirectory = path.join(distDirectory, "zotero");
  const chromiumDirectory = path.join(distDirectory, "chromium");
  const entries = expectedArtifactEntries();
  const zoteroArchive = path.join(
    distDirectory,
    `zotero-ablesci-assistant-${packageJson.version}.xpi`,
  );
  const chromiumArchive = path.join(
    distDirectory,
    `ablesci-chromium-extension-${packageJson.version}.zip`,
  );

  await fs.mkdir(zoteroDirectory, { recursive: true });
  await fs.mkdir(chromiumDirectory, { recursive: true });

  for (const entry of entries.zotero) {
    await fs.rm(path.join(zoteroDirectory, entry), { force: true });
  }
  for (const entry of entries.chromium) {
    await fs.rm(path.join(chromiumDirectory, entry), { force: true });
  }
  await fs.rm(zoteroArchive, { force: true });
  await fs.rm(chromiumArchive, { force: true });

  await bundleIfPresent(
    path.join(root, "src", "zotero", "plugin.js"),
    path.join(zoteroDirectory, "ablesci-assistant.js"),
  );
  await copyIfPresent(
    path.join(root, "src", "zotero", "manifest.json"),
    path.join(zoteroDirectory, "manifest.json"),
  );
  await copyIfPresent(
    path.join(root, "src", "zotero", "bootstrap.js"),
    path.join(zoteroDirectory, "bootstrap.js"),
  );
  await copyIfPresent(
    path.join(root, "src", "zotero", "icon.svg"),
    path.join(zoteroDirectory, "icon.svg"),
  );

  await bundleIfPresent(
    path.join(root, "src", "browser", "background.js"),
    path.join(chromiumDirectory, "background.js"),
  );
  await bundleIfPresent(
    path.join(root, "src", "browser", "content.js"),
    path.join(chromiumDirectory, "content.js"),
  );
  await copyIfPresent(
    path.join(root, "src", "browser", "manifest.json"),
    path.join(chromiumDirectory, "manifest.json"),
  );
  await copyIfPresent(
    path.join(root, "src", "browser", "status-panel.css"),
    path.join(chromiumDirectory, "status-panel.css"),
  );

  if (await hasAllEntries(zoteroDirectory, entries.zotero)) {
    await createArchive(zoteroArchive, zoteroDirectory, entries.zotero);
  }
  if (await hasAllEntries(chromiumDirectory, entries.chromium)) {
    await createArchive(chromiumArchive, chromiumDirectory, entries.chromium);
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  await buildAll();
}
