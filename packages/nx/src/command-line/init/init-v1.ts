import { execSync } from 'child_process';
import { prompt } from 'enquirer';
import { existsSync } from 'fs';
import { prerelease } from 'semver';
import { addNxToMonorepo } from './implementation/add-nx-to-monorepo';
import { addNxToNest } from './implementation/add-nx-to-nest';
import { addNxToNpmRepo } from './implementation/add-nx-to-npm-repo';
import { addNxToAngularCliRepo } from './implementation/angular';
import { generateDotNxSetup } from './implementation/dot-nx/add-nx-scripts';
import { addNxToCraRepo } from './implementation/react';
import { runNxSync } from '../../utils/child-process';
import { directoryExists, readJsonFile } from '../../utils/fileutils';
import { PackageJson } from '../../utils/package-json';
import { nxVersion } from '../../utils/versions';
import { isMonorepo, printFinalMessage } from './implementation/utils';

export interface InitArgs {
  addE2e: boolean;
  force: boolean;
  integrated: boolean;
  interactive: boolean;
  vite: boolean;
  nxCloud?: boolean;
  cacheable?: string[];
  useDotNxInstallation?: boolean;
}

export async function initHandler(options: InitArgs) {
  // strip the 'init' command itself so we don't forward it
  const args = process.argv.slice(3).join(' ');

  const version =
    process.env.NX_VERSION ?? (prerelease(nxVersion) ? 'next' : 'latest');
  if (process.env.NX_VERSION) {
    console.log(`Using version ${process.env.NX_VERSION}`);
  }
  if (options.useDotNxInstallation === true) {
    setupDotNxInstallation(version);
  } else if (existsSync('package.json')) {
    const packageJson: PackageJson = readJsonFile('package.json');
    if (existsSync('angular.json')) {
      await addNxToAngularCliRepo(options);

      printFinalMessage({
        learnMoreLink: 'https://nx.dev/recipes/angular/migration/angular',
      });
      return;
    } else if (isCRA(packageJson)) {
      await addNxToCraRepo(options);

      printFinalMessage({
        learnMoreLink: options.integrated
          ? 'https://nx.dev/getting-started/tutorials/react-monorepo-tutorial'
          : 'https://nx.dev/getting-started/tutorials/react-standalone-tutorial',
      });
      return;
    } else if (isNestCLI(packageJson)) {
      await addNxToNest(options, packageJson);
      printFinalMessage({
        learnMoreLink: 'https://nx.dev/recipes/adopting-nx/adding-to-monorepo',
      });
      return;
    } else if (isMonorepo(packageJson)) {
      await addNxToMonorepo({ ...options, legacy: true });
      printFinalMessage({
        learnMoreLink: 'https://nx.dev/recipes/adopting-nx/adding-to-monorepo',
      });
    } else {
      await addNxToNpmRepo({ ...options, legacy: true });
      printFinalMessage({
        learnMoreLink:
          'https://nx.dev/recipes/adopting-nx/adding-to-existing-project',
      });
    }
  } else {
    const useDotNxFolder = await prompt<{ useDotNxFolder: string }>([
      {
        name: 'useDotNxFolder',
        type: 'autocomplete',
        message: 'Where should your workspace be created?',
        choices: [
          {
            name: 'In a new folder under this directory',
            value: 'false',
          },
          {
            name: 'In this directory',
            value: 'true',
          },
        ],
      },
    ]).then((r) => r.useDotNxFolder === 'true');
    if (useDotNxFolder) {
      setupDotNxInstallation(version);
    } else {
      execSync(`npx --yes create-nx-workspace@${version} ${args}`, {
        stdio: [0, 1, 2],
        windowsHide: false,
      });
    }
  }
}

function isCRA(packageJson: PackageJson) {
  const combinedDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return (
    // Required dependencies for CRA projects
    combinedDependencies['react'] &&
    combinedDependencies['react-dom'] &&
    combinedDependencies['react-scripts'] &&
    // // Don't convert customized CRA projects
    !combinedDependencies['react-app-rewired'] &&
    !combinedDependencies['@craco/craco'] &&
    directoryExists('src') &&
    directoryExists('public')
  );
}

function isNestCLI(packageJson: PackageJson) {
  const combinedDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return (
    existsSync('nest-cli.json') &&
    combinedDependencies['@nestjs/core'] &&
    combinedDependencies['@nestjs/cli']
  );
}

function setupDotNxInstallation(version: string) {
  if (process.platform !== 'win32') {
    console.log(
      'Setting Nx up installation in `.nx`. You can run nx commands like: `./nx --help`'
    );
  } else {
    console.log(
      'Setting Nx up installation in `.nx`. You can run nx commands like: `./nx.bat --help`'
    );
  }
  generateDotNxSetup(version);
  // invokes the wrapper, thus invoking the initial installation process
  runNxSync('--version');
}
