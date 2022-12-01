import { execSync } from 'child_process';
import { prompt } from 'enquirer';
import { PackageManagerCommands } from 'nx/src/utils/package-manager';

export function promptForNxCloud(): Promise<boolean> {
  return prompt([
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
  ]).then((a: { useNxCloud: 'Yes' | 'No' }) => a.useNxCloud === 'Yes');
}

export function initNxCloud(pmc: PackageManagerCommands): void {
  execSync(
    `${pmc.exec} nx g @nrwl/nx-cloud:init --installationSource=make-angular-cli-faster`,
    {
      stdio: [0, 1, 2],
    }
  );
}
