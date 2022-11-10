import { execSync } from 'child_process';
import { copySync, moveSync, readdirSync, removeSync } from 'fs-extra';

import { fileExists, readJsonFile } from 'nx/src/utils/fileutils';
import { output } from 'nx/src/utils/output';
import {
  detectPackageManager,
  getPackageManagerCommand,
  PackageManagerCommands,
} from 'nx/src/utils/package-manager';

import { checkForUncommittedChanges } from './check-for-uncommitted-changes';
import { setupE2eProject } from './setup-e2e-project';
import { readNameFromPackageJson } from './read-name-from-package-json';
import { setupTsConfig } from './tsconfig-setup';
import { writeCracoConfig } from './write-craco-config';
import { cleanUpFiles } from './clean-up-files';
import { writeViteConfig } from './write-vite-config';
import { renameJsToJsx } from './rename-js-to-jsx';
import { writeViteIndexHtml } from './write-vite-index-html';
import { checkForCustomWebpackSetup } from './check-for-custom-webpack-setup';

function addDependencies(pmc: PackageManagerCommands, ...deps: string[]) {
  const depsArg = deps.join(' ');
  output.log({ title: `📦 Adding dependencies: ${depsArg}` });
  execSync(`${pmc.addDev} ${depsArg}`, { stdio: [0, 1, 2] });
}

export async function createNxWorkspaceForReact(options: Record<string, any>) {
  if (!options.force) {
    checkForUncommittedChanges();
    checkForCustomWebpackSetup();
  }
  const packageManager = detectPackageManager();
  const pmc = getPackageManagerCommand(packageManager);

  output.log({ title: '✨ Nx initialization' });

  let appIsJs = true;

  if (fileExists(`tsconfig.json`)) {
    appIsJs = false;
  }

  const reactAppName = readNameFromPackageJson();
  const packageJson = readJsonFile('package.json');
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const isCRA5 = /^[^~]?5/.test(deps['react-scripts']);
  const npmVersion = execSync('npm -v').toString();
  // Should remove this check 04/2023 once Node 14 & npm 6 reach EOL
  const npxYesFlagNeeded = !npmVersion.startsWith('6'); // npm 7 added -y flag to npx
  const isVite = options.vite || options.bundler === 'vite';

  execSync(
    `npx ${
      npxYesFlagNeeded ? '-y' : ''
    } create-nx-workspace@latest temp-workspace --appName=${reactAppName} --preset=react --style=css --packageManager=${packageManager} ${
      options.nxCloud ? '--nxCloud' : '--nxCloud=false'
    }`,
    { stdio: [0, 1, 2] }
  );

  output.log({ title: '👋 Welcome to Nx!' });

  output.log({ title: '🧹 Clearing unused files' });

  copySync(`temp-workspace/apps/${reactAppName}/project.json`, 'project.json');
  removeSync(`temp-workspace/apps/${reactAppName}/`);
  removeSync('node_modules');

  output.log({ title: '🚚 Moving your React app in your new Nx workspace' });

  const requiredCraFiles = [
    'project.json',
    'package.json',
    'src',
    'public',
    appIsJs ? null : 'tsconfig.json',
    packageManager === 'yarn' ? 'yarn.lock' : null,
    packageManager === 'pnpm' ? 'pnpm-lock.yaml' : null,
    packageManager === 'npm' ? 'package-lock.json' : null,
  ];

  const optionalCraFiles = ['README.md'];

  const filesToMove = [...requiredCraFiles, ...optionalCraFiles].filter(
    Boolean
  );

  filesToMove.forEach((f) => {
    try {
      moveSync(f, `temp-workspace/apps/${reactAppName}/${f}`, {
        overwrite: true,
      });
    } catch (error) {
      if (requiredCraFiles.includes(f)) {
        throw error;
      }
    }
  });

  process.chdir('temp-workspace/');

  if (isVite) {
    output.log({ title: '🧑‍🔧  Setting up Vite' });
    const { addViteCommandsToPackageScripts } = await import(
      './add-vite-commands-to-package-scripts'
    );
    addViteCommandsToPackageScripts(reactAppName);
    writeViteConfig(reactAppName);
    writeViteIndexHtml(reactAppName);
    renameJsToJsx(reactAppName);
  } else {
    output.log({ title: '🧑‍🔧  Setting up craco + Webpack' });
    const { addCracoCommandsToPackageScripts } = await import(
      './add-craco-commands-to-package-scripts'
    );
    addCracoCommandsToPackageScripts(reactAppName);

    writeCracoConfig(reactAppName, isCRA5);

    output.log({
      title: '🛬 Skip CRA preflight check since Nx manages the monorepo',
    });

    execSync(`echo "SKIP_PREFLIGHT_CHECK=true" > .env`, { stdio: [0, 1, 2] });
  }

  output.log({ title: '🧶  Add all node_modules to .gitignore' });

  execSync(`echo "node_modules" >> .gitignore`, { stdio: [0, 1, 2] });

  process.chdir('../');

  output.log({ title: '🚚 Folder restructuring.' });

  readdirSync('./temp-workspace').forEach((f) => {
    moveSync(`temp-workspace/${f}`, `./${f}`, { overwrite: true });
  });

  output.log({ title: '🧹  Cleaning up.' });

  cleanUpFiles(reactAppName);

  output.log({ title: "📃 Extend the app's tsconfig.json from the base" });

  setupTsConfig(reactAppName);

  if (options.e2e) {
    output.log({ title: '📃 Setup e2e tests' });
    setupE2eProject(reactAppName);
  } else {
    removeSync(`apps/${reactAppName}-e2e`);
    execSync(`${pmc.rm} @nrwl/cypress eslint-plugin-cypress`);
  }

  output.log({ title: '🙂 Please be patient, one final step remaining!' });

  output.log({
    title: '🧶  Adding npm packages to your new Nx workspace',
  });

  addDependencies(
    pmc,
    '@testing-library/jest-dom',
    'eslint-config-react-app',
    'web-vitals',
    'jest-watch-typeahead'
  );

  if (isVite) {
    addDependencies(pmc, 'vite', 'vitest', '@vitejs/plugin-react');
  } else {
    addDependencies(pmc, '@craco/craco', 'cross-env', 'react-scripts');
  }

  output.log({ title: '🎉 Done!' });
  output.note({
    title: 'First time using Nx? Check out this interactive Nx tutorial.',
    bodyLines: [
      `https://nx.dev/react-tutorial/1-code-generation`,
      ` `,
      `Prefer watching videos? Check out this free Nx course on Egghead.io.`,
      `https://egghead.io/playlists/scale-react-development-with-nx-4038`,
    ],
  });

  if (isVite) {
    output.note({
      title: `A new apps/${reactAppName}/index.html has been created. Compare it to the previous apps/${reactAppName}/public/index.html file and make any changes needed, then delete the previous file.`,
    });
  }

  output.note({
    title: 'Or, you can try the commands!',
    bodyLines: [
      `npx nx serve ${reactAppName}`,
      `npx nx build ${reactAppName}`,
      `npx nx test ${reactAppName}`,
      ` `,
      `https://nx.dev/getting-started/intro#10-try-the-commands`,
    ],
  });
}
