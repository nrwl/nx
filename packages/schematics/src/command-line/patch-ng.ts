import {readFileSync, statSync, writeFileSync} from "fs";
import * as path from 'path';

const nxCheck = `
// nx-check
if (process.argv.indexOf('update') > -1) {
  console.log("This is an Nx workspace, and it provides an enhanced 'update' command.");
  console.log('Please run "npm run update" or "yarn update" instead.');
  process.exit(1);
}
// nx-check-end
`;

export function patchNg() {
  const ngBin = path.join('node_modules', '@angular', 'cli', 'bin', 'ng');
  if (fileExists(ngBin)) {
    const file = readFileSync(ngBin).toString();
    writeFileSync(ngBin, addNxCheck(file));
  }
}

function addNxCheck(file: string): string {
  if (file.indexOf('nx-check') > -1) return file;
  return file.replace(`'use strict';`, `'use strict';${nxCheck}`);
}

function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}