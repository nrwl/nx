import { execSync, ExecSyncOptions } from 'child_process';
import { Frameworks } from './frameworks';
import { join } from 'path';
import * as chalk from 'chalk';

export function generateDevkitDocumentation() {
  console.log(`\n${chalk.blue('i')} Generating Documentation for Devkit\n`);

  const execSyncOptions: ExecSyncOptions = {
    stdio: process.env.CI === 'true' ? 'inherit' : 'ignore',
  };

  execSync('nx build typedoc-theme', execSyncOptions);
  Frameworks.forEach((framework) => {
    execSync(`rm -rf docs/${framework}/api-nx-devkit`, execSyncOptions);
    execSync(
      `npx typedoc packages/devkit/index.ts packages/devkit/ngcli-adapter.ts --tsconfig packages/devkit/tsconfig.lib.json --out ./docs/${framework}/api-nx-devkit --hideBreadcrumbs true --disableSources --publicPath ../../${framework}/nx-devkit/ --theme dist/typedoc-theme/src/lib --readme none`,
      execSyncOptions
    );
    execSync(
      `rm -rf docs/${framework}/api-nx-devkit/modules.md docs/${framework}/api-nx-devkit/.nojekyll docs/${framework}/api-nx-devkit/README.md`,
      execSyncOptions
    );
    execSync(
      `npx prettier docs/${framework}/api-nx-devkit --write --config ${join(
        __dirname,
        '..',
        '..',
        '.prettierrc'
      )}`,
      execSyncOptions
    );
  });
}
