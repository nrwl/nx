import { execSync } from 'child_process';
import { copySync, moveSync, readdirSync, removeSync } from 'fs-extra';
import { join } from 'path';
import { InitArgs } from '../../init';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../../../utils/fileutils';
import { output } from '../../../../utils/output';
import {
  detectPackageManager,
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../../../../utils/package-manager';
import { PackageJson } from '../../../../utils/package-json';
import { askAboutNxCloud, printFinalMessage } from '../utils';
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

type Options = InitArgs;

type NormalizedOptions = Options & {
  packageManager: string;
  pmc: PackageManagerCommands;
  appIsJs: boolean;
  reactAppName: string;
  isCRA5: boolean;
  npxYesFlagNeeded: boolean;
  isVite: boolean;
  isStandalone: boolean;
};

export async function addNxToCraRepo(options: Options) {
  if (!options.force) {
    checkForUncommittedChanges();
    checkForCustomWebpackSetup();
  }

  output.log({ title: '🐳 Nx initialization' });

  const normalizedOptions = await normalizeOptions(options);
  await reorgnizeWorkspaceStructure(normalizedOptions);
}

function installDependencies(options: NormalizedOptions) {
  const dependencies = [
    '@testing-library/jest-dom',
    'eslint-config-react-app',
    'web-vitals',
    'jest-watch-typeahead',
  ];
  if (options.isVite) {
    dependencies.push('vite', 'vitest', '@vitejs/plugin-react');
  } else {
    dependencies.push(
      '@craco/craco',
      'cross-env',
      'react-scripts',
      'tsconfig-paths-webpack-plugin'
    );
  }

  execSync(`${options.pmc.addDev} ${dependencies.join(' ')}`, {
    stdio: [0, 1, 2],
  });
}

async function normalizeOptions(options: Options): Promise<NormalizedOptions> {
  const packageManager = detectPackageManager();
  const pmc = getPackageManagerCommand(packageManager);

  const appIsJs = !fileExists(`tsconfig.json`);

  const reactAppName = readNameFromPackageJson();
  const packageJson = readJsonFile(join(process.cwd(), 'package.json'));
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

  const nxCloud =
    options.nxCloud ?? (options.interactive ? await askAboutNxCloud() : false);

  return {
    ...options,
    nxCloud,
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

/**
 * - Create a temp workspace
 * - Move all files to temp workspace
 * - Add bundler to temp workspace
 * - Move files back to root
 * - Clean up unused files
 */
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

  output.log({ title: '📦 Installing dependencies' });
  installDependencies(options);

  const buildCommand = options.integrated
    ? `npx nx build ${options.reactAppName}`
    : 'npm run build';
  printFinalMessage({
    learnMoreLink: 'https://nx.dev/recipes/adopting-nx/migration-cra',
    bodyLines: [
      `- Execute "${buildCommand}" twice to see the computation caching in action.`,
    ],
  });

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
}

function createTempWorkspace(options: NormalizedOptions) {
  removeSync('temp-workspace');

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

function copyPackageJsonDepsFromTempWorkspace() {
  const repoRoot = process.cwd();
  let rootPackageJson = readJsonFile(join(repoRoot, 'package.json'));
  const tempWorkspacePackageJson = readJsonFile(
    join(repoRoot, 'temp-workspace', 'package.json')
  );

  rootPackageJson = overridePackageDeps(
    'dependencies',
    rootPackageJson,
    tempWorkspacePackageJson
  );
  rootPackageJson = overridePackageDeps(
    'devDependencies',
    rootPackageJson,
    tempWorkspacePackageJson
  );
  rootPackageJson.scripts = {}; // remove existing scripts
  writeJsonFile(join(repoRoot, 'package.json'), rootPackageJson);
  writeJsonFile(
    join(repoRoot, 'temp-workspace', 'package.json'),
    rootPackageJson
  );
}

function overridePackageDeps(
  depConfigName: 'dependencies' | 'devDependencies',
  base: PackageJson,
  override: PackageJson
): PackageJson {
  if (!base[depConfigName]) {
    base[depConfigName] = override[depConfigName];
    return base;
  }
  const deps = override[depConfigName];
  Object.keys(deps).forEach((dep) => {
    if (base.dependencies?.[dep]) {
      delete base.dependencies[dep];
    }
    if (base.devDependencies?.[dep]) {
      delete base.devDependencies[dep];
    }
    base[depConfigName][dep] = deps[dep];
  });
  return base;
}

function moveFilesToTempWorkspace(options: NormalizedOptions) {
  output.log({ title: '🚚 Moving your React app in your new Nx workspace' });

  copyPackageJsonDepsFromTempWorkspace();
  const requiredCraFiles = [
    'project.json',
    'package.json',
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

  if (options.addE2e && !options.isStandalone) {
    output.log({ title: '📃 Setup e2e tests' });
    setupE2eProject(options.reactAppName);
  } else {
    removeSync(join('apps', `${options.reactAppName}-e2e`));
    execSync(`${options.pmc.rm} cypress @nx/cypress eslint-plugin-cypress`);
  }

  if (options.isStandalone) {
    removeSync('apps');
  }
}
