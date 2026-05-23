#!/usr/bin/env node
/**
 * Downloads llama.cpp prebuilt binaries into buildResources/llama-runtime/.
 * Copies llama-server, .dylib (macOS), .dll (Windows), and macOS @rpath symlinks.
 */
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, readdir, rm, copyFile, symlink, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'buildResources', 'llama-runtime');

/** @type {{ key: string; assetSuffix: string; archiveKind: 'zip' | 'tgz'; binaryName: string }[]} */
const TARGETS = [
  {
    key: 'darwin-arm64',
    assetSuffix: 'macos-arm64',
    archiveKind: 'tgz',
    binaryName: 'llama-server',
  },
  {
    key: 'darwin-x64',
    assetSuffix: 'macos-x64',
    archiveKind: 'tgz',
    binaryName: 'llama-server',
  },
  {
    key: 'win32-x64',
    assetSuffix: 'win-cpu-x64',
    archiveKind: 'zip',
    binaryName: 'llama-server.exe',
  },
];

const LLAMA_RELEASE_TAG = process.env.LLAMA_RELEASE_TAG ?? 'b9277';

function resolveHostPlatformKey() {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'win32-x64';
  }
  return null;
}

function resolveFetchTargets() {
  const onlyCurrent = ['1', 'true', 'yes'].includes(
    process.env.LLAMA_RUNTIME_ONLY?.trim().toLowerCase() ?? '',
  );
  const platformsEnv = process.env.LLAMA_RUNTIME_PLATFORMS?.trim();
  let keys = null;
  if (platformsEnv) {
    keys = new Set(
      platformsEnv
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
  } else if (onlyCurrent) {
    const hostKey = resolveHostPlatformKey();
    if (!hostKey) {
      throw new Error(
        `LLAMA_RUNTIME_ONLY=1 但当前平台 ${process.platform}/${process.arch} 无预构建运行时`,
      );
    }
    keys = new Set([hostKey]);
  }

  if (!keys) {
    return TARGETS;
  }

  const selected = TARGETS.filter((target) => keys.has(target.key));
  if (selected.length === 0) {
    throw new Error(`未匹配任何 llama 平台目录，可用: ${TARGETS.map((t) => t.key).join(', ')}`);
  }
  return selected;
}

function archiveFileName(suffix, archiveKind) {
  const ext = archiveKind === 'tgz' ? 'tar.gz' : 'zip';
  return `llama-${LLAMA_RELEASE_TAG}-bin-${suffix}.${ext}`;
}

function isRuntimeFile(name, binaryName) {
  return name === binaryName || name.endsWith('.dylib') || name.endsWith('.dll');
}

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

async function copyRuntimeFiles(bundleDir, destDir, binaryName) {
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(bundleDir, { withFileTypes: true });
  let fileCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !isRuntimeFile(entry.name, binaryName)) {
      continue;
    }
    const src = join(bundleDir, entry.name);
    const dest = join(destDir, entry.name);
    await copyFile(src, dest);
    if (entry.name === binaryName && !binaryName.endsWith('.exe')) {
      await chmod(dest, 0o755);
    }
    fileCount += 1;
  }
  return fileCount;
}

async function linkDarwinRpathLibraries(destDir, binaryName) {
  const binary = join(destDir, binaryName);
  const { stdout } = await execFileAsync('otool', ['-L', binary]);
  const needed = [
    ...new Set([...stdout.matchAll(/@rpath\/(\S+\.dylib)/g)].map((match) => match[1])),
  ];
  const entries = await readdir(destDir);
  for (const lib of needed) {
    const linkPath = join(destDir, lib);
    await rm(linkPath, { force: true });
    const base = lib.replace(/\.dylib$/, '');
    const candidate = entries.find(
      (name) => name.startsWith(`${base}.`) && name.endsWith('.dylib'),
    );
    if (!candidate) {
      throw new Error(
        `未找到 ${lib} 对应文件（已有: ${entries.filter((n) => n.endsWith('.dylib')).join(', ')})`,
      );
    }
    await symlink(candidate, linkPath);
  }
}

async function extractArchive(archivePath, destDir, archiveKind) {
  await mkdir(destDir, { recursive: true });
  if (archiveKind === 'tgz') {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return;
  }
  if (process.platform === 'win32') {
    await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } else {
    await execFileAsync('unzip', ['-o', archivePath, '-d', destDir], {
      maxBuffer: 10 * 1024 * 1024,
    });
  }
}

async function main() {
  const baseUrl = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_RELEASE_TAG}`;
  const targets = resolveFetchTargets();

  await mkdir(outRoot, { recursive: true });
  await rm(join(outRoot, '.tmp'), { recursive: true, force: true });

  for (const target of targets) {
    const fileName = archiveFileName(target.assetSuffix, target.archiveKind);
    const archiveUrl = `${baseUrl}/${fileName}`;
    const tmpDir = join(outRoot, '.tmp', target.key);
    const archivePath = join(tmpDir, fileName);
    const extractDir = join(tmpDir, 'extracted');
    const destDir = join(outRoot, target.key);

    console.log(`Fetching ${target.key} from ${archiveUrl}`);
    await mkdir(tmpDir, { recursive: true });
    try {
      await download(archiveUrl, archivePath);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} (url: ${archiveUrl}). ` +
          `可设置 LLAMA_RELEASE_TAG 指定其它 release tag。`,
      );
    }
    await extractArchive(archivePath, extractDir, target.archiveKind);

    const found = await findBinary(extractDir, target.binaryName);
    if (!found) {
      throw new Error(`Could not find ${target.binaryName} in ${extractDir}`);
    }

    const bundleDir = dirname(found);
    const fileCount = await copyRuntimeFiles(bundleDir, destDir, target.binaryName);
    if (target.key.startsWith('darwin')) {
      await linkDarwinRpathLibraries(destDir, target.binaryName);
    }
    console.log(
      `Installed ${target.key} -> ${join(destDir, target.binaryName)} (${fileCount} files)`,
    );
  }

  await rm(join(outRoot, '.tmp'), { recursive: true, force: true });
  await writeFile(join(outRoot, '.gitkeep'), '\n');
  console.log('llama-runtime ready at', outRoot);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
