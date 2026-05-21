#!/usr/bin/env node
/**
 * Downloads llama.cpp prebuilt binaries into buildResources/llama-runtime/.
 * Requires: unzip (macOS/Linux) or tar + Expand-Archive on Windows.
 */
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'buildResources', 'llama-runtime');

/** @type {{ key: string; assetSuffix: string; binaryName: string }[]} */
const TARGETS = [
  { key: 'darwin-arm64', assetSuffix: 'macos-arm64', binaryName: 'llama-server' },
  { key: 'darwin-x64', assetSuffix: 'macos-x64', binaryName: 'llama-server' },
  { key: 'win32-x64', assetSuffix: 'win-x64', binaryName: 'llama-server.exe' },
];

const LLAMA_RELEASE_TAG = process.env.LLAMA_RELEASE_TAG ?? 'b6167';

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status}: ${url}`);
  }
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(res.body, createWriteStream(dest));
}

async function findBinary(dir, name) {
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        const hit = await walk(full);
        if (hit) {
          return hit;
        }
      } else if (entry.name === name) {
        return full;
      }
    }
    return null;
  }
  return walk(dir);
}

async function extractZip(zipPath, destDir) {
  await mkdir(destDir, { recursive: true });
  if (process.platform === 'win32') {
    await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } else {
    await execFileAsync('unzip', ['-o', zipPath, '-d', destDir], {
      maxBuffer: 10 * 1024 * 1024,
    });
  }
}

async function main() {
  const zipName = (suffix) => `llama-${LLAMA_RELEASE_TAG}-bin-${suffix}.zip`;
  const baseUrl = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_RELEASE_TAG}`;

  await rm(outRoot, { recursive: true, force: true });
  await mkdir(outRoot, { recursive: true });

  for (const target of TARGETS) {
    const zipUrl = `${baseUrl}/${zipName(target.assetSuffix)}`;
    const tmpDir = join(outRoot, '.tmp', target.key);
    const zipPath = join(tmpDir, 'archive.zip');
    const extractDir = join(tmpDir, 'extracted');
    const destDir = join(outRoot, target.key);

    console.log(`Fetching ${target.key} from ${zipUrl}`);
    await mkdir(tmpDir, { recursive: true });
    await download(zipUrl, zipPath);
    await extractZip(zipPath, extractDir);

    const found = await findBinary(extractDir, target.binaryName);
    if (!found) {
      throw new Error(`Could not find ${target.binaryName} in ${extractDir}`);
    }

    await mkdir(destDir, { recursive: true });
    const destPath = join(destDir, target.binaryName);
    await copyFile(found, destPath);
    if (!target.binaryName.endsWith('.exe')) {
      await chmod(destPath, 0o755);
    }
    console.log(`Installed ${target.key} -> ${destPath}`);
  }

  await rm(join(outRoot, '.tmp'), { recursive: true, force: true });
  console.log('llama-runtime ready at', outRoot);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
