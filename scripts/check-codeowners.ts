import * as fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import { output } from '@nx/devkit';

async function main() {
  const codeowners = fs.readFileSync(
    path.join(__dirname, '../CODEOWNERS'),
    'utf-8'
  );
  const codeownersLines = codeowners
    .split('\n')
    .filter((line) => line.trim().length > 0 && !line.startsWith('#'));

  const errors: string[] = [];

  for (const line of codeownersLines) {
    // This is perhaps a bit naive, but it should
    // work for all paths and patterns that do not
    // contain spaces.
    const specifiedPattern = line.split(' ')[0];
    let foundMatchingFiles = false;

    const patternsToCheck = specifiedPattern.startsWith('/')
      ? [`.${specifiedPattern}`]
      : [`./${specifiedPattern}`, `**/${specifiedPattern}`];

    for (const pattern of patternsToCheck) {
      foundMatchingFiles ||=
        fg.sync(pattern, {
          ignore: ['node_modules', 'dist', 'build', '.git'],
          cwd: path.join(__dirname, '..'),
          onlyFiles: false,
        }).length > 0;
    }
    if (!foundMatchingFiles) {
      errors.push(specifiedPattern);
    }
  }
  if (errors.length > 0) {
    output.error({
      title: `The following patterns in CODEOWNERS do not match any files:`,
      bodyLines: errors.map((e) => `- ${e}`),
    });
    process.exit(1);
  }
}

main();
