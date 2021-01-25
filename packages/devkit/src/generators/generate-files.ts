import * as path from 'path';
import * as fs from 'fs';
import { Tree } from '@nrwl/tao/src/shared/tree';

const ejs = require('ejs');

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
  allFilesInDir(srcFolder).forEach((f) => {
    const relativeToTarget = replaceSegmentsInPath(
      f.substring(srcFolder.length),
      substitutions
    );
    const newContent = ejs.render(fs.readFileSync(f).toString(), substitutions);
    host.write(path.join(target, relativeToTarget), newContent);
  });
}

function replaceSegmentsInPath(
  filePath: string,
  substitutions: { [k: string]: any }
) {
  Object.entries(substitutions).forEach(([t, r]) => {
    filePath = filePath.replace(`__${t}__`, r);
  });
  return filePath;
}

function allFilesInDir(parent: string) {
  let res = [];
  try {
    fs.readdirSync(parent).forEach((c) => {
      const child = path.join(parent, c);
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
