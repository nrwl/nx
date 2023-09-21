import * as chalk from 'chalk';
import { execSync, ExecSyncOptions } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export function generateDevkitDocumentation() {
  console.log(`\n${chalk.blue('i')} Generating Documentation for Devkit\n`);

  const execSyncOptions: ExecSyncOptions = {
    stdio: 'true' === 'true' ? 'inherit' : 'ignore',
    // stdio: process.env.CI === 'true' ? 'inherit' : 'ignore',
  };

  execSync(
    'nx build devkit && nx build typedoc-theme && rm -rf node_modules/@nx/typedoc-theme && cp -R dist/typedoc-theme node_modules/@nx/typedoc-theme',
    execSyncOptions
  );

  execSync(
    'cp packages/devkit/tsconfig.lib.json build/packages/devkit/tsconfig.lib.json',
    execSyncOptions
  );

  writeFileSync(
    'build/packages/devkit/tsconfig.lib.json',
    readFileSync('build/packages/devkit/tsconfig.lib.json')
      .toString()
      .replace(
        '"extends": "./tsconfig.json"',
        '"extends": "../../../packages/devkit/tsconfig.json"'
      )
  );

  execSync(
    `rm -rf docs/generated/devkit && pnpm typedoc build/packages/devkit/index.d.ts --tsconfig build/packages/devkit/tsconfig.lib.json --out ./docs/generated/devkit --plugin typedoc-plugin-markdown --plugin @nx/typedoc-theme --hideBreadcrumbs true --disableSources --allReflectionsHaveOwnDocument --publicPath ../../devkit/ --theme nx-markdown-theme --excludePrivate --readme none`,
    execSyncOptions
  );
  execSync(
    `pnpm typedoc build/packages/devkit/ngcli-adapter.d.ts --tsconfig build/packages/devkit/tsconfig.lib.json --out ./docs/generated/devkit/ngcli_adapter --plugin typedoc-plugin-markdown --plugin @nx/typedoc-theme --hideBreadcrumbs true --disableSources --allReflectionsHaveOwnDocument --publicPath ../../devkit/ngcli_adapter/ --theme nx-markdown-theme --readme none`,
    execSyncOptions
  );
  execSync(`rm -rf build/packages/devkit/tsconfig.lib.json`, execSyncOptions);
  execSync(`rm -rf docs/generated/devkit/.nojekyll`, execSyncOptions);
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
