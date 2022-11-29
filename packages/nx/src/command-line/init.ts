import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { readJsonFile } from '../utils/fileutils';
import { addNxToNpmRepo } from '../nx-init/add-nx-to-npm-repo';

export async function initHandler() {
  const args = process.argv.slice(2).join(' ');
  if (existsSync('package.json')) {
    if (existsSync('angular.json')) {
      // TODO(leo): remove make-angular-cli-faster
      execSync(`npx --yes make-angular-cli-faster@latest ${args}`, {
        stdio: [0, 1, 2],
      });
    } else if (isMonorepo()) {
      // TODO: vsavkin remove add-nx-to-monorepo
      execSync(`npx --yes add-nx-to-monorepo@latest ${args}`, {
        stdio: [0, 1, 2],
      });
    } else {
      await addNxToNpmRepo();
    }
  } else {
    execSync(`npx --yes create-nx-workspace@latest ${args}`, {
      stdio: [0, 1, 2],
    });
  }
}

function isMonorepo() {
  const packageJson = readJsonFile('package.json');
  if (!!packageJson.workspaces) return true;

  if (existsSync('pnpm-workspace.yaml') || existsSync('pnpm-workspace.yml'))
    return true;

  if (existsSync('lerna.json')) return true;

  return false;
}
