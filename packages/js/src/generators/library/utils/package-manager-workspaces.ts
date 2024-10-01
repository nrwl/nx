import {
  detectPackageManager,
  getPackageManagerVersion,
  output,
  type GeneratorCallback,
} from '@nx/devkit';
import { lt } from 'semver';
import type { ProjectPackageManagerWorkspaceState } from '../../../utils/package-manager-workspaces';

export function getProjectPackageManagerWorkspaceStateWarningTask(
  projectPackageManagerWorkspaceState: ProjectPackageManagerWorkspaceState,
  workspaceRoot: string
): GeneratorCallback {
  return (): void => {
    const packageManager = detectPackageManager(workspaceRoot);
    let packageManagerWorkspaceSetupDocs: string;
    if (packageManager === 'pnpm') {
      packageManagerWorkspaceSetupDocs =
        'https://pnpm.io/workspaces and https://pnpm.io/pnpm-workspace_yaml';
    } else if (packageManager === 'yarn') {
      const yarnVersion = getPackageManagerVersion(
        packageManager,
        workspaceRoot
      );
      if (lt(yarnVersion, '2.0.0')) {
        packageManagerWorkspaceSetupDocs =
          'https://classic.yarnpkg.com/lang/en/docs/workspaces/';
      } else {
        packageManagerWorkspaceSetupDocs =
          'https://yarnpkg.com/features/workspaces';
      }
    } else if (packageManager === 'npm') {
      packageManagerWorkspaceSetupDocs =
        'https://docs.npmjs.com/cli/v10/using-npm/workspaces';
    } else if (packageManager === 'bun') {
      packageManagerWorkspaceSetupDocs =
        'https://bun.sh/docs/install/workspaces';
    }

    if (projectPackageManagerWorkspaceState === 'no-workspaces') {
      output.warn({
        title: `The package manager workspaces feature is not enabled in the workspace`,
        bodyLines: [
          'You must enable the package manager workspaces feature to use the "@nx/js/typescript" plugin.',
          `Read more about the ${packageManager} workspaces feature and how to set it up at ${packageManagerWorkspaceSetupDocs}.`,
        ],
      });
    } else if (projectPackageManagerWorkspaceState === 'excluded') {
      output.warn({
        title: `The project is not included in the package manager workspaces configuration`,
        bodyLines: [
          'Please add it to the workspace configuration to use the "@nx/js/typescript" plugin.',
          `Read more about the ${packageManager} workspaces feature and how to set it up at ${packageManagerWorkspaceSetupDocs}.`,
        ],
      });
    }
  };
}
