import * as fs from 'fs';
import * as path from 'path';
import { Tree } from '@nrwl/tao/src/shared/tree';
import { join, relative } from 'path';

const ejs = require('ejs');

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

  // Java files
  '.jar',
  '.keystore',
]);

/**
 * Generates a folder of files based on provided templates.
 *
 * While doing so it performs two substitutions:
 * - Substitutes segments of file names surrounded by __
 * - Uses ejs to substitute values in templates
 *
 * @param host - the file system tree
 * @param srcFolder - the source folder of files (absolute path)
 * @param target - the target folder (relative to the host root)
 * @param substitutions - an object of key-value pairs
 *
 * Examples:
 *
 * ```typescript
 * generateFiles(host, path.join(__dirname , 'files'), './tools/scripts', {tmpl: '', name: 'myscript'})
 * ```
 *
 * This command will take all the files from the `files` directory next to the place where the command is invoked from.
 * It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all
 * `<%= name %>` with `myscript` in the files themselves.
 *
 * `tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor
 * doesn't get confused about incorrect TypeScript files.
 */
export function generateFiles(
  host: Tree,
  srcFolder: string,
  target: string,
  substitutions: { [k: string]: any }
) {
  allFilesInDir(srcFolder).forEach((filePath) => {
    let newContent: Buffer | string;
    const computedPath = computePath(
      srcFolder,
      target,
      filePath,
      substitutions
    );

    if (binaryExts.has(path.extname(filePath))) {
      newContent = fs.readFileSync(filePath);
    } else {
      const template = fs.readFileSync(filePath).toString();
      newContent = ejs.render(template, substitutions, {});
    }

    host.write(computedPath, newContent);
  });
}

function computePath(
  srcFolder: string,
  target: string,
  filePath: string,
  substitutions: { [k: string]: any }
) {
  const relativeFromSrcFolder = relative(srcFolder, filePath);
  let computedPath = join(target, relativeFromSrcFolder);
  if (computedPath.endsWith('.template')) {
    computedPath = computedPath.substring(0, computedPath.length - 9);
  }
  Object.entries(substitutions).forEach(([propertyName, value]) => {
    computedPath = computedPath.split(`__${propertyName}__`).join(value);
  });
  return computedPath;
}

function allFilesInDir(parent: string) {
  let res = [];
  try {
    fs.readdirSync(parent).forEach((c) => {
      const child = join(parent, c);
      try {
        const s = fs.statSync(child);
        if (!s.isDirectory()) {
          res.push(child);
        } else if (s.isDirectory()) {
          res = [...res, ...allFilesInDir(child)];
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}
