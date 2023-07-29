import * as chalk from 'chalk';
import { execSync, ExecSyncOptions } from 'child_process';
import { join } from 'path';

export function generateDevkitDocumentation() {
  console.log(`\n${chalk.blue('i')} Generating Documentation for Devkit\n`);

  const execSyncOptions: ExecSyncOptions = {
    stdio: process.env.CI === 'true' ? 'inherit' : 'ignore',
  };

  execSync(
    'nx build typedoc-theme && rm -rf node_modules/@nx/typedoc-theme && cp -R dist/typedoc-theme node_modules/@nx/typedoc-theme',
    execSyncOptions
  );

  execSync(
    `rm -rf docs/generated/devkit && pnpm typedoc packages/devkit/index.d.ts packages/devkit/ngcli-adapter.ts --tsconfig packages/devkit/tsconfig.lib.json --out ./docs/generated/devkit --plugin typedoc-plugin-markdown --plugin @nx/typedoc-theme --hideBreadcrumbs true --disableSources --publicPath ../../devkit/ --theme nx-markdown-theme --readme none`,
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
    `pnpm prettier docs/generated/devkit --write --config ${join(
      __dirname,
      '..',
      '..',
      '..',
      '.prettierrc'
    )}`,
    execSyncOptions
  );
}
