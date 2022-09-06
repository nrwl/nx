import { getPackageManagerCommand } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { prompt } from 'enquirer';

export async function promptForNxCloud(): Promise<boolean> {
  const { useNxCloud } = await prompt<{ useNxCloud: 'Yes' | 'No' }>([
    {
      name: 'useNxCloud',
      message: `Enable distributed caching to make your CI faster`,
      type: 'autocomplete',
      choices: [
        {
          name: 'Yes',
          hint: 'I want faster builds',
        },
        { name: 'No' },
      ],
      initial: 'Yes' as any,
    },
  ]);

  return useNxCloud === 'Yes';
}

export function initNxCloud(): void {
  execSync(
    `${
      getPackageManagerCommand().exec
    } nx g @nrwl/nx-cloud:init --installationSource=make-angular-cli-faster`,
    {
      stdio: [0, 1, 2],
    }
  );
}
