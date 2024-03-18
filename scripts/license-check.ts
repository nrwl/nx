import { join } from 'path';
import { lines, h1, h2, unorderedList } from 'markdown-factory';
import { writeFileSync } from 'fs';

const checker: typeof import('license-checker') = require('license-checker');

const map: Record<string, string> = {
  'The Apache License, Version 2.0': 'Apache-2.0',
  'Apache License, Version 2.0': 'Apache-2.0',
  'The Apache Software License, Version 2.0': 'Apache-2.0',
  'Apache Software License - Version 2.0': 'Apache-2.0',
  'Eclipse Public License - Version 1.0': 'Eclipse Public License-1.0',
  'Eclipse Public License': 'Eclipse Public License-2.0',
  'Eclipse Public License v. 2.0': 'Eclipse Public License-2.0',
  'Eclipse Public License - v 1.0': 'Eclipse Public License-1.0',
  'MIT License': 'MIT',
  'The MIT License (MIT)': 'MIT',
  'New BSD License': 'New BSD License',
  'CDDL/GPLv2+CE': 'CDDL-1.0',
  'COMMON DEVELOPMENT AND DISTRIBUTION LICENSE (CDDL) Version 1.0': 'CDDL-1.0',
  'CDDL 1.1': 'CDDL-1.1',
  'MIT*': 'MIT',
  CC0: 'CC0',
};

checker.init(
  {
    start: join(__dirname, '..'),
  },
  (err, modules) => {
    const packagesByLicense: Record<string, string[]> = {};
    Object.entries(modules).forEach(([name, info]) => {
      const licenseKey =
        (Array.isArray(info.licenses) ? info.licenses[0] : info.licenses) ??
        'unknown';
      const license = map[licenseKey] ?? licenseKey;
      packagesByLicense[license] ??= [];
      packagesByLicense[license].push(name);
    });
    const md = Object.entries(packagesByLicense).reduce(
      (txt, [license, packages]) =>
        lines(
          txt,
          h2(
            license,
            unorderedList(
              packages.map((p) => `[${p}](https://www.npmjs.com/${p})`)
            )
          )
        ),
      h1(
        'License report',
        'This report contains the licenses for all dependencies used by any project for the Nx monorepo.'
      )
    );
    writeFileSync(join(__dirname, '../build/license-report.md'), md);
  }
);
