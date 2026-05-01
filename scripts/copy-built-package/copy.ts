import { hash } from 'crypto';
import fs, { existsSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { globSync } from 'tinyglobby';
import { ProgressDisplay } from './progress';

export const WORKSPACE_ROOT = join(__dirname, '../..');

export function copyBuiltPackage(
  pkg: { pkgRoot: string; npmName: string },
  outputWorkspace: string
) {
  const pathInDist = join(WORKSPACE_ROOT, 'dist', pkg.pkgRoot);
  const copyRoot = existsSync(pathInDist) ? pathInDist : pkg.pkgRoot;

  if (copyRoot === pkg.pkgRoot) {
    console.warn(`No build artifacts in "${pathInDist}, checking project root`);
  }

  // Copy all files from dist/packages/<pkg> to the output package root
  const files = globSync(`**/*.js`, {
    cwd: copyRoot,
    dot: true,
    ignore: ['**/node_modules/**'],
  });

  if (!files.length) {
    throw new Error(
      `Unable to find built artifacts for ${pkg.npmName}. Did you forget to build?`
    );
  }

  const outputPkgRoot = join(outputWorkspace, 'node_modules', pkg.npmName);
  fs.mkdirSync(outputPkgRoot, { recursive: true });

  // Get native files count for accurate total
  const nativeFiles = getNativeFiles(pkg.pkgRoot);
  const totalFiles = files.length + nativeFiles.length;
  const progress = new ProgressDisplay(totalFiles);

  files.forEach((file) => {
    const destFile = join(outputPkgRoot, file);
    const destDir = dirname(destFile);
    const copySrc = join(copyRoot, file);
    const relativeFilePath = relative(copyRoot, copySrc);
    progress.update(relativeFilePath);
    fs.mkdirSync(destDir, { recursive: true });
    safeCopyFileSync(copySrc, destFile, progress);
  });

  // Copy native files
  copyNativeFiles(pkg.pkgRoot, outputPkgRoot, nativeFiles, progress);
  progress.finish();
}

function getNativeFiles(pkgRoot: string): string[] {
  const copyRoot = join(WORKSPACE_ROOT, pkgRoot);
  return globSync(`**/*.{node,wasm,js,mjs,cjs}`, {
    ignore: [
      '**/node_modules/**',
      'src/command-line/migrate/run-migration-process.js',
    ],
    cwd: copyRoot,
  });
}

function copyNativeFiles(
  pkgRoot: string,
  outputPkgRoot: string,
  nativeFiles: string[],
  progress: ProgressDisplay
) {
  const copyRoot = join(WORKSPACE_ROOT, pkgRoot);
  nativeFiles.forEach((file) => {
    const destFile = join(outputPkgRoot, file);
    const destDir = dirname(destFile);
    const copySrc = join(copyRoot, file);
    const relativeFilePath = relative(copyRoot, copySrc);
    progress.update(relativeFilePath);
    fs.mkdirSync(destDir, { recursive: true });
    safeCopyFileSync(copySrc, destFile, progress);
  });
}

function safeCopyFileSync(
  src: string,
  dest: string,
  progress: ProgressDisplay
) {
  const sha = hash('sha256', readFileSync(src));
  for (let i = 0; i < 3; i++) {
    try {
      fs.copyFileSync(src, dest);
      const destSha = hash('sha256', readFileSync(dest));
      if (sha === destSha) {
        return;
      } else {
        progress.insertBefore(
          `Hash mismatch when copying ${src} to ${dest}, retrying...`
        );
      }
    } catch (e) {
      progress.insertBefore(
        `Error copying file ${src} to ${dest}: ${(e as Error).message}, retrying...`
      );
    }
  }
  throw new Error(`Failed to copy ${src} to ${dest} after 3 attempts.`);
}
