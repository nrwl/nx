import {
  detectPackageManager,
  getPackageManagerVersion,
  output,
  readJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { minimatch } from 'minimatch';
import { join } from 'node:path/posix';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json';
import { PackageJson } from 'nx/src/utils/package-json';
import { lt } from 'semver';

export type ProjectPackageManagerWorkspaceState =
  | 'included'
  | 'excluded'
  | 'no-workspaces';

export function getProjectPackageManagerWorkspaceState(
  tree: Tree,
  projectRoot: string
): ProjectPackageManagerWorkspaceState {
  if (!isUsingPackageManagerWorkspaces(tree)) {
    return 'no-workspaces';
  }

  const patterns = getGlobPatternsFromPackageManagerWorkspaces(
    tree.root,
    (path) => readJson(tree, path, { expectComments: true })
  );
  const isIncluded = patterns.some((p) =>
    minimatch(join(projectRoot, 'package.json'), p)
  );

  return isIncluded ? 'included' : 'excluded';
}

export function isUsingPackageManagerWorkspaces(tree: Tree): boolean {
  return isWorkspacesEnabled(tree);
}

export function isWorkspacesEnabled(
  tree: Tree
  // packageManager: PackageManager = detectPackageManager(),
  // root: string = workspaceRoot
): boolean {
  const packageManager = detectPackageManager(tree.root);
  if (packageManager === 'pnpm') {
    return tree.exists('pnpm-workspace.yaml');
  }

  // yarn and npm both use the same 'workspaces' property in package.json
  const packageJson = readJson<PackageJson>(tree, 'package.json');
  return !!packageJson?.workspaces;
}

export function getProjectPackageManagerWorkspaceStateWarningTask(
  projectPackageManagerWorkspaceState: ProjectPackageManagerWorkspaceState,
  workspaceRoot: string
): GeneratorCallback {
  return (): void => {
    if (projectPackageManagerWorkspaceState !== 'excluded') {
      return;
    }

    const packageManager = detectPackageManager(workspaceRoot);
    let adviseMessage =
      'updating the "workspaces" option in the workspace root "package.json" file with the project root or pattern that includes it';
    let packageManagerWorkspaceSetupDocs: string;
    if (packageManager === 'pnpm') {
      adviseMessage =
        'updating the "pnpm-workspace.yaml" file with the project root or pattern that includes it';
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

    output.warn({
      title: `The project is not included in the package manager workspaces configuration`,
      bodyLines: [
        `Please add the project to the package manager workspaces configuration by ${adviseMessage}.`,
        `Read more about the ${packageManager} workspaces feature and how to set it up at ${packageManagerWorkspaceSetupDocs}.`,
      ],
    });
  };
}
