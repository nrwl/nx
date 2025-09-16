import {
  detectPackageManager,
  getPackageManagerVersion,
  output,
  readJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import picomatch = require('picomatch');
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

  const patterns = getPackageManagerWorkspacesPatterns(tree);
  const isIncluded = patterns.some((p) =>
    picomatch(p)(join(projectRoot, 'package.json'))
  );

  return isIncluded ? 'included' : 'excluded';
}

export function getPackageManagerWorkspacesPatterns(tree: Tree): string[] {
  return getGlobPatternsFromPackageManagerWorkspaces(
    tree.root,
    (path) => readJson(tree, path, { expectComments: true }),
    (path) => {
      const content = tree.read(path, 'utf-8');
      const { load } = require('@zkochan/js-yaml');
      return load(content, { filename: path });
    },
    (path) => tree.exists(path)
  );
}

export function isUsingPackageManagerWorkspaces(tree: Tree): boolean {
  return isWorkspacesEnabled(tree);
}

export function isWorkspacesEnabled(tree: Tree): boolean {
  const packageManager = detectPackageManager(tree.root);
  if (packageManager === 'pnpm') {
    if (!tree.exists('pnpm-workspace.yaml')) {
      return false;
    }

    try {
      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const { load } = require('@zkochan/js-yaml');
      const { packages } = load(content) ?? {};
      return packages !== undefined;
    } catch {
      return false;
    }
  }

  // yarn and npm both use the same 'workspaces' property in package.json
  if (tree.exists('package.json')) {
    const packageJson = readJson<PackageJson>(tree, 'package.json');
    return !!packageJson?.workspaces;
  }
  return false;
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
