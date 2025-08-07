import * as chalk from 'chalk';
import * as typedoc from 'typedoc';
import { execSync, ExecSyncOptions } from 'child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

export async function generateDevkitDocumentation() {
  console.log(`\n${chalk.blue('i')} Generating Documentation for Devkit\n`);

  const execSyncOptions: ExecSyncOptions = {
    stdio: 'true' === 'true' ? 'inherit' : 'ignore',
    // stdio: process.env.CI === 'true' ? 'inherit' : 'ignore',
    windowsHide: false,
  };

  // TypeDoc theme is now available as a workspace dependency

  cpSync(
    'packages/devkit/tsconfig.lib.json',
    'dist/packages/devkit/tsconfig.lib.json',
    { recursive: true }
  );

  writeFileSync(
    'dist/packages/devkit/tsconfig.lib.json',
    readFileSync('dist/packages/devkit/tsconfig.lib.json')
      .toString()
      .replace(
        '"extends": "../../tsconfig.base.json"',
        '"extends": "../../../packages/devkit/tsconfig.json"'
      )
  );

  rmSync('docs/generated/devkit', { recursive: true, force: true });

  const commonTypedocOptions: Partial<typedoc.TypeDocOptions> & {
    [key: string]: unknown;
  } = {
    plugin: [
      'typedoc-plugin-markdown',
      join(
        __dirname,
        '..',
        '..',
        '..',
        'dist',
        'typedoc-theme',
        'src',
        'index.js'
      ),
    ],
    disableSources: true,
    theme: 'nx-markdown-theme',
    readme: 'none',
    hideBreadcrumbs: true,
    allReflectionsHaveOwnDocument: true,
  } as const;

  await runTypedoc({
    ...commonTypedocOptions,
    entryPoints: ['dist/packages/devkit/index.d.ts'],
    tsconfig: 'dist/packages/devkit/tsconfig.lib.json',
    out: 'docs/generated/devkit',
    excludePrivate: true,
    publicPath: '/reference/core-api/devkit/',
  });

  await runTypedoc({
    ...commonTypedocOptions,
    entryPoints: ['dist/packages/devkit/ngcli-adapter.d.ts'],
    tsconfig: 'dist/packages/devkit/tsconfig.lib.json',
    out: 'docs/generated/devkit/ngcli_adapter',
    publicPath: '/reference/core-api/devkit/ngcli_adapter/',
  });

  rmSync('dist/packages/devkit/tsconfig.lib.json', {
    recursive: true,
    force: true,
  });
  rmSync('docs/generated/devkit/.nojekyll', { recursive: true, force: true });

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

async function runTypedoc(
  options: Partial<typedoc.TypeDocOptions> & { [key: string]: unknown }
) {
  const app = await typedoc.Application.bootstrapWithPlugins(
    options as Partial<typedoc.TypeDocOptions>,
    [
      new typedoc.TypeDocReader(),
      new typedoc.PackageJsonReader(),
      new typedoc.TSConfigReader(),
    ]
  );
  const project = await app.convert();
  if (!project) {
    throw new Error('Failed to convert the project');
  }
  await app.generateDocs(project, app.options.getValue('out'));
}
