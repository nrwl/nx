import { readFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';
import type { Tree } from 'nx/src/generators/tree';
import { logger } from 'nx/src/utils/logger';

const binaryExts = new Set([
  // // Image types originally from https://github.com/sindresorhus/image-type/blob/5541b6a/index.js
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.flif',
  '.cr2',
  '.tif',
  '.bmp',
  '.jxr',
  '.psd',
  '.ico',
  '.bpg',
  '.jp2',
  '.jpm',
  '.jpx',
  '.heic',
  '.cur',
  '.tgz',

  // Java files
  '.jar',
  '.keystore',

  // Font files
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
]);

/**
 * Generates a folder of files based on provided templates.
 *
 * While doing so it performs two substitutions:
 * - Substitutes segments of file names surrounded by __
 * - Uses ejs to substitute values in templates
 *
 * Examples:
 * ```typescript
 * generateFiles(tree, path.join(__dirname , 'files'), './tools/scripts', {tmpl: '', name: 'myscript'})
 * ```
 * This command will take all the files from the `files` directory next to the place where the command is invoked from.
 * It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all
 * `<%= name %>` with `myscript` in the files themselves.
 * `tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor
 * doesn't get confused about incorrect TypeScript files.
 *
 * @param tree - the file system tree
 * @param srcFolder - the source folder of files (absolute path)
 * @param target - the target folder (relative to the tree root)
 * @param substitutions - an object of key-value pairs
 */
export function generateFiles(
  tree: Tree,
  srcFolder: string,
  target: string,
  substitutions: { [k: string]: any }
): void {
  const ejs = require('ejs');

  const files = allFilesInDir(srcFolder);
  if (files.length === 0) {
    throw new Error(
      `generateFiles: No files found in "${srcFolder}". Are you sure you specified the correct path?`
    );
  } else {
    files.forEach((filePath) => {
      let newContent: Buffer | string;
      const computedPath = computePath(
        srcFolder,
        target,
        filePath,
        substitutions
      );

      if (binaryExts.has(path.extname(filePath))) {
        newContent = readFileSync(filePath);
      } else {
        const template = readFileSync(filePath, 'utf-8');
        try {
          newContent = ejs.render(template, substitutions, {});
        } catch (e) {
          logger.error(`Error in ${filePath.replace(`${tree.root}/`, '')}:`);
          throw e;
        }
      }

      tree.write(computedPath, newContent);
    });
  }
}

function computePath(
  srcFolder: string,
  target: string,
  filePath: string,
  substitutions: { [k: string]: any }
): string {
  const relativeFromSrcFolder = path.relative(srcFolder, filePath);
  let computedPath = path.join(target, relativeFromSrcFolder);
  if (computedPath.endsWith('.template')) {
    computedPath = computedPath.substring(0, computedPath.length - 9);
  }
  Object.entries(substitutions).forEach(([propertyName, value]) => {
    computedPath = computedPath.split(`__${propertyName}__`).join(value);
  });
  return computedPath;
}

function allFilesInDir(parent: string): string[] {
  let res: string[] = [];
  try {
    readdirSync(parent).forEach((c) => {
      const child = path.join(parent, c);
      try {
        const s = statSync(child);
        if (!s.isDirectory()) {
          res.push(child);
        } else if (s.isDirectory()) {
          res = [...res, ...allFilesInDir(child)];
        }
      } catch {}
    });
  } catch {}
  return res;
}
