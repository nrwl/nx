import * as inquirer from 'inquirer';
import { readNxJson } from '../core/file-utils';
import { output } from '../utilities/output';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';
import { execSync } from 'child_process';

export async function promptForNxCloud(scan: boolean) {
  if (!scan) return;

  const nxJson = readNxJson();
  const defaultRunnerIsUsed = Object.values(nxJson.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/workspace/tasks-runners/default'
  );
  if (!defaultRunnerIsUsed) return;

  const res = await askAboutNxCloud();
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
