import { readFileSync, writeFileSync } from 'fs';
import { output } from '../utils/output';

export function decorateCli() {
  output.warn({
    title: `Decoration of the Angular CLI is deprecated and will be removed in a future version`,
    bodyLines: [
      `Please replace usage of "ng <command>" in any scripts, particularly for CI, with "nx <command>"`,
    ],
  });
  const path = 'node_modules/@angular/cli/lib/cli/index.js';
  const angularCLIInit = readFileSync(path, 'utf-8');
  const start = angularCLIInit.indexOf(`(options) {`) + 11;

  const newContent = `${angularCLIInit.slice(0, start)}
  if (!process.env['NX_CLI_SET']) {
    require('nx/bin/nx');
    return new Promise(function(res, rej) {});
  }
  ${angularCLIInit.substring(start)}
`;
  writeFileSync(path, newContent);
}
