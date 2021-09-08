import * as chalk from 'chalk';
import { execSync, exec } from 'child_process';
import { join } from 'path';
import { Frameworks } from './frameworks';

import { generateCLIDocumentation } from './generate-cli-data';
import { generateExecutorsDocumentation } from './generate-executors-data';
import { generateGeneratorsDocumentation } from './generate-generators-data';

async function generate() {
  console.log(`${chalk.blue('i')} Generating Documentation`);

  execSync('nx build typedoc-theme');
  Frameworks.forEach((framework) => {
    execSync(
      `rm -rf docs/${framework}/api-nx-devkit && npx typedoc packages/devkit/index.ts packages/devkit/ngcli-adapter.ts --tsconfig packages/devkit/tsconfig.lib.json --out ./docs/${framework}/api-nx-devkit --hideBreadcrumbs true --disableSources --publicPath ../../${framework}/nx-devkit/ --theme dist/typedoc-theme/src/lib`
    );
    execSync(
      `rm -rf docs/${framework}/api-nx-devkit/modules.md docs/${framework}/api-nx-devkit/README.md`
    );
    execSync(
      `npx prettier docs/${framework}/api-nx-devkit --write --config ${join(
        __dirname,
        '..',
        '..',
        '.prettierrc'
      )}`
    );
  });
  await generateGeneratorsDocumentation();
  await generateExecutorsDocumentation();
  await generateCLIDocumentation();

  console.log(`\n${chalk.green('✓')} Generated Documentation\n`);
}

function checkDocumentation() {
  const output = execSync('git status --porcelain ./docs').toString('utf-8');

  if (output) {
    console.log(
      `${chalk.red(
        '!'
      )} 📄 Documentation has been modified, you need to commit the changes. ${chalk.red(
        '!'
      )} `
    );

    console.log('\nChanged Docs:');
    execSync('git status --porcelain ./docs', { stdio: 'inherit' });

    process.exit(1);
  } else {
    console.log('📄 Documentation not modified');
  }
}

generate().then(() => {
  checkDocumentation();
});

function printInfo(
  str: string,
  newLine: boolean = true,
  newLineAfter: boolean = true
) {
  console.log(
    `${newLine ? '\n' : ''}${chalk.blue('i')} ${str}${newLineAfter ? '\n' : ''}`
  );
}
