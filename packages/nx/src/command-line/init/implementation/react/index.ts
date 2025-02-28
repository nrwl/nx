import { execSync } from 'child_process';
import { join } from 'path';
import { appendFileSync } from 'fs';

import { InitArgs } from '../../init-v1';
import { fileExists } from '../../../../utils/fileutils';
import { output } from '../../../../utils/output';
import {
  detectPackageManager,
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../../../../utils/package-manager';
import { checkForCustomWebpackSetup } from './check-for-custom-webpack-setup';
import { readNameFromPackageJson } from './read-name-from-package-json';
import { renameJsToJsx } from './rename-js-to-jsx';
import { writeViteConfig } from './write-vite-config';
import { writeViteIndexHtml } from './write-vite-index-html';

type Options = InitArgs;

type NormalizedOptions = Options & {
  packageManager: string;
  pmc: PackageManagerCommands;
  appIsJs: boolean;
  reactAppName: string;
  isStandalone: boolean;
};

export async function addNxToCraRepo(_options: Options) {
  if (!_options.force) {
    checkForCustomWebpackSetup();
  }

  const options = await normalizeOptions(_options);

  await addBundler(options);

  appendFileSync(`.gitignore`, '\nnode_modules');
  appendFileSync(`.gitignore`, '\ndist');

  installDependencies(options);

  // Vite expects index.html to be in the root as the main entry point.
  const indexPath = options.isStandalone
    ? 'index.html'
    : join('apps', options.reactAppName, 'index.html');
  const oldIndexPath = options.isStandalone
    ? join('public', 'index.html')
    : join('apps', options.reactAppName, 'public', 'index.html');
  output.note({
    title: `A new ${indexPath} has been created. Compare it to the previous ${oldIndexPath} file and make any changes needed, then delete the previous file.`,
  });

  if (_options.force) {
    output.note({
      title: `Using --force converts projects with custom Webpack setup. You will need to manually update your vite.config.js file to match the plugins used in your old Webpack configuration.`,
    });
  }
}

function installDependencies(options: NormalizedOptions) {
  const dependencies = [
    '@rollup/plugin-replace',
    '@testing-library/jest-dom',
    '@vitejs/plugin-react',
    'eslint-config-react-app',
    'web-vitals',
    'jest-watch-typeahead',
    'vite',
    'vitest',
  ];

  execSync(`${options.pmc.addDev} ${dependencies.join(' ')}`, {
    stdio: [0, 1, 2],
    windowsHide: false,
  });
}

async function normalizeOptions(options: Options): Promise<NormalizedOptions> {
  const packageManager = detectPackageManager();
  const pmc = getPackageManagerCommand(packageManager);
  const appIsJs = !fileExists(`tsconfig.json`);
  const reactAppName = readNameFromPackageJson();
  const isStandalone = !options.integrated;
  return {
    ...options,
    packageManager,
    pmc,
    appIsJs,
    reactAppName,
    isStandalone,
  };
}

async function addBundler(options: NormalizedOptions) {
  const { addViteCommandsToPackageScripts } = await import(
    './add-vite-commands-to-package-scripts'
  );
  addViteCommandsToPackageScripts(options.reactAppName, options.isStandalone);
  writeViteConfig(options.reactAppName, options.isStandalone, options.appIsJs);
  writeViteIndexHtml(
    options.reactAppName,
    options.isStandalone,
    options.appIsJs
  );
  await renameJsToJsx(options.reactAppName, options.isStandalone);
}
