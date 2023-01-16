import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { addNxToNest } from '../nx-init/add-nx-to-nest';
import { addNxToNpmRepo } from '../nx-init/add-nx-to-npm-repo';
import { directoryExists, readJsonFile } from '../utils/fileutils';
import { PackageJson } from '../utils/package-json';

export async function initHandler() {
  const args = process.argv.slice(2).join(' ');
  const version = process.env.NX_VERSION ?? 'latest';
  if (process.env.NX_VERSION) {
    console.log(`Using version ${process.env.NX_VERSION}`);
  }
  if (existsSync('package.json')) {
    const packageJson: PackageJson = readJsonFile('package.json');
    if (existsSync('angular.json')) {
      // TODO(leo): remove make-angular-cli-faster
      execSync(`npx --yes make-angular-cli-faster@${version} ${args}`, {
        stdio: [0, 1, 2],
      });
    } else if (isCRA(packageJson)) {
      // TODO(jack): remove cra-to-nx
      execSync(`npx --yes cra-to-nx@${version} ${args}`, {
        stdio: [0, 1, 2],
      });
    } else if (isNestCLI(packageJson)) {
      await addNxToNest(packageJson);
    } else if (isMonorepo(packageJson)) {
      // TODO: vsavkin remove add-nx-to-monorepo
      execSync(`npx --yes add-nx-to-monorepo@${version} ${args}`, {
        stdio: [0, 1, 2],
      });
    } else {
      await addNxToNpmRepo();
    }
  } else {
    execSync(`npx --yes create-nx-workspace@${version} ${args}`, {
      stdio: [0, 1, 2],
    });
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

function isMonorepo(packageJson: PackageJson) {
  if (!!packageJson.workspaces) return true;

  if (existsSync('pnpm-workspace.yaml') || existsSync('pnpm-workspace.yml'))
    return true;

  if (existsSync('lerna.json')) return true;

  return false;
}
