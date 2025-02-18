import { execSync } from 'child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'path';
import { InitArgs } from '../../init-v1';
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
import { checkForCustomWebpackSetup } from './check-for-custom-webpack-setup';
import { checkForUncommittedChanges } from './check-for-uncommitted-changes';
import { cleanUpFiles } from './clean-up-files';
import { readNameFromPackageJson } from './read-name-from-package-json';
import { renameJsToJsx } from './rename-js-to-jsx';
import { setupTsConfig } from './tsconfig-setup';
import { writeCracoConfig } from './write-craco-config';
import { writeViteConfig } from './write-vite-config';
import { writeViteIndexHtml } from './write-vite-index-html';
import { connectExistingRepoToNxCloudPrompt } from '../../../connect/connect-to-nx-cloud';

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

  output.log({ title: '📦 Installing Nx' });

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
    windowsHide: false,
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
  const npmVersion = execSync('npm -v', {
    windowsHide: false,
  }).toString();
  // Should remove this check 04/2023 once Node 14 & npm 6 reach EOL
  const npxYesFlagNeeded = !npmVersion.startsWith('6'); // npm 7 added -y flag to npx
  const isVite = options.vite;
  const isStandalone = !options.integrated;

  const nxCloud =
    options.nxCloud ??
    (options.interactive ? await connectExistingRepoToNxCloudPrompt() : false);

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

  execSync(`echo "node_modules" >> .gitignore`, {
    stdio: [0, 1, 2],
    windowsHide: false,
  });
  execSync(`echo "dist" >> .gitignore`, {
    stdio: [0, 1, 2],
    windowsHide: false,
  });

  process.chdir('..');

  copyFromTempWorkspaceToRoot();

  cleanUpUnusedFilesAndAddConfigFiles(options);

  installDependencies(options);

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
  rmSync('temp-workspace', { recursive: true, force: true });

  execSync(
    `npx ${
      options.npxYesFlagNeeded ? '-y' : ''
    } create-nx-workspace@latest temp-workspace --appName=${
      options.reactAppName
    } --preset=react-monorepo --style=css --bundler=${
      options.isVite ? 'vite' : 'webpack'
    } --packageManager=${options.packageManager} ${
      options.nxCloud ? '--nxCloud=yes' : '--nxCloud=skip'
    } ${
      options.addE2e ? '--e2eTestRunner=playwright' : '--e2eTestRunner=none'
    }`,
    { stdio: [0, 1, 2], windowsHide: false }
  );

  rmSync(join('temp-workspace', 'apps', options.reactAppName), {
    recursive: true,
    force: true,
  });
  rmSync('node_modules', { recursive: true, force: true });
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

function moveSync(src: string, dest: string) {
  const destParentDir = dirname(dest);
  mkdirSync(destParentDir, { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  return renameSync(src, dest);
}

function moveFilesToTempWorkspace(options: NormalizedOptions) {
  copyPackageJsonDepsFromTempWorkspace();
  const requiredCraFiles = [
    'package.json',
    'src',
    'public',
    options.appIsJs ? null : 'tsconfig.json',
    options.packageManager === 'yarn' ? 'yarn.lock' : null,
    options.packageManager === 'pnpm' ? 'pnpm-lock.yaml' : null,
    options.packageManager === 'npm' ? 'package-lock.json' : null,
    options.packageManager === 'bun' ? 'bun.lockb' : null,
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
          : join('temp-workspace', 'apps', options.reactAppName, f)
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
    await renameJsToJsx(options.reactAppName, options.isStandalone);
  } else {
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

    execSync(`echo "SKIP_PREFLIGHT_CHECK=true" > .env`, {
      stdio: [0, 1, 2],
      windowsHide: false,
    });
  }
}

function copyFromTempWorkspaceToRoot() {
  readdirSync('temp-workspace').forEach((f) => {
    moveSync(join('temp-workspace', f), f);
  });
}

function cleanUpUnusedFilesAndAddConfigFiles(options: NormalizedOptions) {
  cleanUpFiles(options.reactAppName, options.isStandalone);

  setupTsConfig(options.reactAppName, options.isStandalone);

  if (options.isStandalone) {
    rmSync('apps', { recursive: true, force: true });
  }
}
