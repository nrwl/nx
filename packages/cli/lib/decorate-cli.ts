import { readFileSync, writeFileSync } from 'fs';

export function decorateCli() {
  const path = 'node_modules/@angular/cli/lib/cli/index.js';
  const angularCLIInit = readFileSync(path, 'utf-8').toString();
  const start = angularCLIInit.indexOf(`(options) {`) + 11;
  const end = angularCLIInit.lastIndexOf(`}`) - 2;

  const newContent = `${angularCLIInit.substr(0, start)}
  if (!process.env['NX_CLI_SET']) {
    require('@nrwl/cli/bin/nx');
    return new Promise(function(res, rej) {});
  } else {
    ${angularCLIInit.substring(start, end)}
  }
${angularCLIInit.substring(end)}
`;
  writeFileSync(path, newContent);
}
