import * as inquirer from 'inquirer';
import { readNxJson } from '../core/file-utils';
import { output } from '../utilities/output';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';
import { execSync } from 'child_process';

export async function connectToNxCloudUsingScan(scan: boolean) {
  if (!scan) return;

  const nxJson = readNxJson();
  const defaultRunnerIsUsed = Object.values(nxJson.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/workspace/tasks-runners/default'
  );
  if (!defaultRunnerIsUsed) return;

  output.log({
    title: '--scan requires the workspace to be connected to Nx Cloud.',
  });
  const res = await connectToNxCloudPrompt();
  if (res) {
    const pmc = getPackageManagerCommand();
    execSync(`${pmc.addDev} @nrwl/nx-cloud@latest`);
    execSync(`${pmc.exec} nx g @nrwl/nx-cloud:init`, {
      stdio: [0, 1, 2],
    });
  } else {
    output.log({ title: 'Executing the command without --scan' });
  }
}

export async function connectToNxCloudCommand() {
  const nxJson = readNxJson();
  const nxCloudUsed = Object.values(nxJson.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud'
  );
  if (nxCloudUsed) {
    output.log({
      title: 'This workspace is already connected to Nx Cloud.',
    });
    return;
  }

  const res = await connectToNxCloudPrompt();
  if (!res) return;
  const pmc = getPackageManagerCommand();
  execSync(`${pmc.addDev} @nrwl/nx-cloud@latest`);
  execSync(`${pmc.exec} nx g @nrwl/nx-cloud:init`, {
    stdio: [0, 1, 2],
  });
}

async function connectToNxCloudPrompt() {
  return inquirer
    .prompt([
      {
        name: 'NxCloud',
        message: `Connect to Nx Cloud? (It's free and doesn't require registration.)`,
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
