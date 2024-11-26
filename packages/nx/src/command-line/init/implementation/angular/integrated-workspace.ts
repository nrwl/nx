import { execSync } from 'child_process';
import { getPackageManagerCommand } from '../../../../utils/package-manager';

export function setupIntegratedWorkspace(): void {
  const pmc = getPackageManagerCommand();
  execSync(`${pmc.exec} nx g @nx/angular:ng-add`, {
    stdio: [0, 1, 2],

    windowsHide: true,
  });
}
