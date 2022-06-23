import { getPackageManagerCommand } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { prompt } from 'enquirer';

export async function promptForNxCloud(): Promise<boolean> {
  const { useNxCloud } = await prompt<{ useNxCloud: 'Yes' | 'No' }>([
    {
      name: 'useNxCloud',
      message: `Set up distributed caching using Nx Cloud (It's free and doesn't require registration.)`,
      type: 'select',
      choices: [
        {
          name: 'Yes',
          hint: 'Yes [Faster builds, run details, Github integration. Learn more at https://nx.app]',
        },
        { name: 'No' },
      ],
      initial: 'Yes' as any,
    },
  ]);

  return useNxCloud === 'Yes';
}

export function initNxCloud(): void {
  execSync(`${getPackageManagerCommand().exec} nx g @nrwl/nx-cloud:init`, {
    stdio: [0, 1, 2],
  });
}
