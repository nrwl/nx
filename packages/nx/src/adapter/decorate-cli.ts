import { readFileSync, writeFileSync } from 'fs';

export function decorateCli() {
  const path = 'node_modules/@angular/cli/lib/cli/index.js';
  const angularCLIInit = readFileSync(path, 'utf-8');
  const start = angularCLIInit.indexOf(`(options) {`) + 11;

  const newContent = `${angularCLIInit.substr(0, start)}
  if (!process.env['NX_CLI_SET']) {
    require('nx/bin/nx');
    return new Promise(function(res, rej) {});
  }
  ${angularCLIInit.substring(start)}
`;
  writeFileSync(path, newContent);
}
