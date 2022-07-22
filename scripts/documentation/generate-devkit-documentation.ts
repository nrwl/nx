import { execSync, ExecSyncOptions } from 'child_process';
import { join } from 'path';
import * as chalk from 'chalk';

export function generateDevkitDocumentation() {
  console.log(`\n${chalk.blue('i')} Generating Documentation for Devkit\n`);

  const execSyncOptions: ExecSyncOptions = {
    stdio: process.env.CI === 'true' ? 'inherit' : 'ignore',
  };

  execSync('nx build typedoc-theme', execSyncOptions);

  execSync(
    `rm -rf docs/generated/devkit && npx typedoc packages/devkit/index.ts packages/devkit/ngcli-adapter.ts --tsconfig packages/devkit/tsconfig.lib.json --out ./docs/generated/devkit --hideBreadcrumbs true --disableSources --publicPath ../../devkit/ --theme dist/typedoc-theme/src/lib --readme none`,
    execSyncOptions
  );
  execSync(
    `rm -rf docs/generated/devkit/modules.md docs/generated/devkit/.nojekyll`,
    execSyncOptions
  );
  execSync(
    `rm -rf docs/generated/devkit/modules.md docs/generated/devkit/README.md`,
    execSyncOptions
  );
  execSync(
    `npx prettier docs/generated/devkit --write --config ${join(
      __dirname,
      '..',
      '..',
      '.prettierrc'
    )}`,
    execSyncOptions
  );
}
