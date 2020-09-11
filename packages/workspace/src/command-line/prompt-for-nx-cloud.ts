import * as inquirer from 'inquirer';
import { readNxJson } from '../core/file-utils';
import { output } from '../utils/output';
import { detectPackageManager } from '../utils/detect-package-manager';
import { execSync } from 'child_process';

export async function promptForNxCloud(scan: boolean) {
  if (!scan) return;

  const nxJson = readNxJson();
  const nxCloudRunnerIsUsed = Object.values(nxJson.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud'
  );
  if (nxCloudRunnerIsUsed) return;

  const res = await askAboutNxCloud();
  if (res) {
    const pm = detectPackageManager();
    if (pm === 'yarn') {
      execSync('yarn add -D @nrwl/nx-cloud@latest');
    } else {
      execSync('npm install --save-dev @nrwl/nx-cloud@latest');
    }
    execSync(`npx nx g @nrwl/nx-cloud:init`, {
      stdio: [0, 1, 2],
    });
  } else {
    output.log({ title: 'Executing the command without --scan' });
  }
}

async function askAboutNxCloud() {
  output.log({
    title: '--scan requires the workspace to be connected to Nx Cloud.',
  });
  return inquirer
    .prompt([
      {
        name: 'NxCloud',
        message: `Use Nx Cloud? (It's free and doesn't require registration.)`,
        type: 'list',
        choices: [
          {
            value: 'yes',
            name:
              'Yes [Faster builds, run details, Github integration. Learn more at https://nx.app]',
          },

          {
            value: 'no',
            name: 'No',
          },
        ],
        default: 'no',
      },
    ])
    .then((a: { NxCloud: 'yes' | 'no' }) => a.NxCloud === 'yes');
}
