import { runNxSync } from '../../../../utils/child-process';

export function setupIntegratedWorkspace(): void {
  runNxSync(`g @nx/angular:ng-add`, {
    stdio: [0, 1, 2],
  });
}
