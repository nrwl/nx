import { output } from '../utils/output';
import { getPackageManagerCommand } from '../utils/package-manager';
import { execSync } from 'child_process';
import { readNxJson } from '../config/configuration';

export async function connectToNxCloudUsingScan(scan: boolean): Promise<void> {
  if (!scan) return;

  const nxJson = readNxJson();
  const defaultRunnerIsUsed = Object.values(nxJson.tasksRunnerOptions).find(
    (r) =>
      r.runner == '@nrwl/workspace/tasks-runners/default' ||
      r.runner == 'nx/tasks-runners/default'
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

export async function connectToNxCloudCommand(
  promptOverride?: string
): Promise<void> {
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

  const res = await connectToNxCloudPrompt(promptOverride);
  if (!res) return;
  const pmc = getPackageManagerCommand();
  execSync(`${pmc.addDev} @nrwl/nx-cloud@latest`);
  execSync(`${pmc.exec} nx g @nrwl/nx-cloud:init`, {
    stdio: [0, 1, 2],
  });
}

async function connectToNxCloudPrompt(prompt?: string) {
  return await (
    await import('enquirer')
  )
    .prompt([
      {
        name: 'NxCloud',
        message:
          prompt ??
          `Set up distributed caching using Nx Cloud (It's free and doesn't require registration.)`,
        type: 'select',
        choices: [
          {
            name: 'Yes',
            hint: 'Faster builds, run details, GitHub integration. Learn more at https://nx.app',
          },
          {
            name: 'No',
          },
        ],
        initial: 'Yes' as any,
      },
    ])
    .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');
}
