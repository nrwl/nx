import { execSync } from 'child_process';
import { copySync, moveSync, readdirSync, removeSync } from 'fs-extra';
import { join } from 'path';
import * as yargsParser from 'yargs-parser';
import { fileExists, readJsonFile } from '../../utils/fileutils';
import { output } from '../../utils/output';
import {
  PackageManagerCommands,
  detectPackageManager,
  getPackageManagerCommand,
} from '../../utils/package-manager';
import { checkForCustomWebpackSetup } from './check-for-custom-webpack-setup';
import { checkForUncommittedChanges } from './check-for-uncommitted-changes';
import { cleanUpFiles } from './clean-up-files';
import { readNameFromPackageJson } from './read-name-from-package-json';
import { renameJsToJsx } from './rename-js-to-jsx';
import { setupE2eProject } from './setup-e2e-project';
import { setupTsConfig } from './tsconfig-setup';
import { writeCracoConfig } from './write-craco-config';
import { writeViteConfig } from './write-vite-config';
import { writeViteIndexHtml } from './write-vite-index-html';

export interface Options {
  force: boolean;
  e2e: boolean;
  nxCloud: boolean;
  vite: boolean;
  integrated: boolean;
}

interface NormalizedOptions extends Options {
  packageManager: string;
  pmc: PackageManagerCommands;
  appIsJs: boolean;
  reactAppName: string;
  isCRA5: boolean;
  npxYesFlagNeeded: boolean;
  isVite: boolean;
  isStandalone: boolean;
}

const parsedArgs = yargsParser(process.argv, {
  boolean: ['force', 'e2e', 'nxCloud', 'vite', 'integrated'],
  default: {
    nxCloud: true,
    vite: true,
  },
  configuration: {
    'strip-dashed': true,
  },
});

export async function addNxToCraRepo() {
  if (!parsedArgs.force) {
    checkForUncommittedChanges();
    checkForCustomWebpackSetup();
  }

  output.log({ title: '✨ Nx initialization' });

  const normalizedOptions = normalizeOptions(parsedArgs as unknown as Options);
  await reorgnizeWorkspaceStructure(normalizedOptions);
}

function addDependencies(pmc: PackageManagerCommands, ...deps: string[]) {
  const depsArg = deps.join(' ');
  output.log({ title: `📦 Adding dependencies: ${depsArg}` });
  execSync(`${pmc.addDev} ${depsArg}`, { stdio: [0, 1, 2] });
}

function normalizeOptions(options: Options): NormalizedOptions {
  const packageManager = detectPackageManager();
  const pmc = getPackageManagerCommand(packageManager);

  const appIsJs = !fileExists(`tsconfig.json`);

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
  const isVite = options.vite;
  const isStandalone = !options.integrated;

  return {
    ...options,
    packageManager,
    pmc,
    appIsJs,
    reactAppName,
    isCRA5,
    npxYesFlagNeeded,
    isVite,
    isStandalone,
  };
}

async function reorgnizeWorkspaceStructure(options: NormalizedOptions) {
  createTempWorkspace(options);

  moveFilesToTempWorkspace(options);

  await addBundler(options);

  output.log({ title: '🧶  Updating .gitignore file' });

  execSync(`echo "node_modules" >> .gitignore`, { stdio: [0, 1, 2] });
  execSync(`echo "dist" >> .gitignore`, { stdio: [0, 1, 2] });

  process.chdir('..');

  copyFromTempWorkspaceToRoot();

  cleanUpUnusedFilesAndAddConfigFiles(options);

  output.log({ title: '🙂 Please be patient, one final step remaining!' });

  output.log({
    title: '🧶  Adding npm packages to your new Nx workspace',
  });

  addDependencies(
    options.pmc,
    '@testing-library/jest-dom',
    'eslint-config-react-app',
    'web-vitals',
    'jest-watch-typeahead'
  );

  if (options.isVite) {
    addDependencies(options.pmc, 'vite', 'vitest', '@vitejs/plugin-react');
  } else {
    addDependencies(
      options.pmc,
      '@craco/craco',
      'cross-env',
      'react-scripts',
      'tsconfig-paths-webpack-plugin'
    );
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

  if (options.isVite) {
    const indexPath = options.isStandalone
      ? 'index.html'
      : join('apps', options.reactAppName, 'index.html');
    const oldIndexPath = options.isStandalone
      ? join('public', 'index.html')
      : join('apps', options.reactAppName, 'public', 'index.html');
    output.note({
      title: `A new ${indexPath} has been created. Compare it to the previous ${oldIndexPath} file and make any changes needed, then delete the previous file.`,
    });
  }

  output.note({
    title: 'Or, you can try the commands!',
    bodyLines: [
      options.integrated ? `npx nx serve ${options.reactAppName}` : 'npm start',
      options.integrated
        ? `npx nx build ${options.reactAppName}`
        : 'npm run build',
      options.integrated ? `npx nx test ${options.reactAppName}` : `npm test`,
      ` `,
      `https://nx.dev/getting-started/intro#10-try-the-commands`,
    ],
  });
}

function createTempWorkspace(options: NormalizedOptions) {
  execSync(
    `npx ${
      options.npxYesFlagNeeded ? '-y' : ''
    } create-nx-workspace@latest temp-workspace --appName=${
      options.reactAppName
    } --preset=react-monorepo --style=css --bundler=${
      options.isVite ? 'vite' : 'webpack'
    } --packageManager=${options.packageManager} ${
      options.nxCloud ? '--nxCloud' : '--nxCloud=false'
    }`,
    { stdio: [0, 1, 2] }
  );

  output.log({ title: '👋 Welcome to Nx!' });

  output.log({ title: '🧹 Clearing unused files' });

  copySync(
    join('temp-workspace', 'apps', options.reactAppName, 'project.json'),
    'project.json'
  );
  removeSync(join('temp-workspace', 'apps', options.reactAppName));
  removeSync('node_modules');
}

function moveFilesToTempWorkspace(options: NormalizedOptions) {
  output.log({ title: '🚚 Moving your React app in your new Nx workspace' });

  const requiredCraFiles = [
    'project.json',
    options.isStandalone ? null : 'package.json',
    'src',
    'public',
    options.appIsJs ? null : 'tsconfig.json',
    options.packageManager === 'yarn' ? 'yarn.lock' : null,
    options.packageManager === 'pnpm' ? 'pnpm-lock.yaml' : null,
    options.packageManager === 'npm' ? 'package-lock.json' : null,
  ];

  const optionalCraFiles = ['README.md'];

  const filesToMove = [...requiredCraFiles, ...optionalCraFiles].filter(
    Boolean
  );

  filesToMove.forEach((f) => {
    try {
      moveSync(
        f,
        options.isStandalone
          ? join('temp-workspace', f)
          : join('temp-workspace', 'apps', options.reactAppName, f),
        {
          overwrite: true,
        }
      );
    } catch (error) {
      if (requiredCraFiles.includes(f)) {
        throw error;
      }
    }
  });

  process.chdir('temp-workspace');
}

async function addBundler(options: NormalizedOptions) {
  if (options.isVite) {
    output.log({ title: '🧑‍🔧  Setting up Vite' });
    const { addViteCommandsToPackageScripts } = await import(
      './add-vite-commands-to-package-scripts'
    );
    addViteCommandsToPackageScripts(options.reactAppName, options.isStandalone);
    writeViteConfig(
      options.reactAppName,
      options.isStandalone,
      options.appIsJs
    );
    writeViteIndexHtml(
      options.reactAppName,
      options.isStandalone,
      options.appIsJs
    );
    renameJsToJsx(options.reactAppName, options.isStandalone);
  } else {
    output.log({ title: '🧑‍🔧  Setting up craco + Webpack' });
    const { addCracoCommandsToPackageScripts } = await import(
      './add-craco-commands-to-package-scripts'
    );
    addCracoCommandsToPackageScripts(
      options.reactAppName,
      options.isStandalone
    );

    writeCracoConfig(
      options.reactAppName,
      options.isCRA5,
      options.isStandalone
    );

    output.log({
      title: '🛬 Skip CRA preflight check since Nx manages the monorepo',
    });

    execSync(`echo "SKIP_PREFLIGHT_CHECK=true" > .env`, { stdio: [0, 1, 2] });
  }
}

function copyFromTempWorkspaceToRoot() {
  output.log({ title: '🚚 Folder restructuring.' });

  readdirSync('temp-workspace').forEach((f) => {
    moveSync(join('temp-workspace', f), f, { overwrite: true });
  });
}

function cleanUpUnusedFilesAndAddConfigFiles(options: NormalizedOptions) {
  output.log({ title: '🧹  Cleaning up.' });

  cleanUpFiles(options.reactAppName, options.isStandalone);

  output.log({ title: "📃 Extend the app's tsconfig.json from the base" });

  setupTsConfig(options.reactAppName, options.isStandalone);

  if (options.e2e && !options.isStandalone) {
    output.log({ title: '📃 Setup e2e tests' });
    setupE2eProject(options.reactAppName);
  } else {
    removeSync(join('apps', `${options.reactAppName}-e2e`));
    execSync(`${options.pmc.rm} @nrwl/cypress eslint-plugin-cypress`);
  }

  if (options.isStandalone) {
    removeSync('apps');
  }
}
