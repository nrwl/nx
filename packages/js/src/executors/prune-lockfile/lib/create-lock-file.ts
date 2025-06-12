import { PackageJson } from 'nx/src/utils/package-json';
import { ProjectGraph } from 'nx/src/config/project-graph';
import {
  detectPackageManager,
  PackageManager,
} from 'nx/src/utils/package-manager';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { pruneProjectGraph } from './project-graph-pruning';
import { readFileSync } from 'node:fs';
import { output } from 'nx/src/utils/output';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { normalizePackageJson } from 'nx/src/plugins/js/lock-file/utils/package-json';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { stringifyYarnLockfile } from 'nx/src/plugins/js/lock-file/yarn-parser';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { stringifyPnpmLockfile } from 'nx/src/plugins/js/lock-file/pnpm-parser';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { stringifyNpmLockfile } from 'nx/src/plugins/js/lock-file/npm-parser';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getLockFilePath } from 'nx/src/plugins/js/lock-file/lock-file';

export function createLockFile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  const normalizedPackageJson = normalizePackageJson(packageJson);
  const content = readFileSync(getLockFilePath(packageManager), 'utf8');

  try {
    if (packageManager === 'yarn') {
      const { updatedGraph: prunedGraph, combinedDependencies } =
        pruneProjectGraph(graph, packageJson);
      const updatedPackageJson = createNewPackageJson(
        normalizedPackageJson,
        combinedDependencies
      );
      return stringifyYarnLockfile(prunedGraph, content, updatedPackageJson);
    }
    if (packageManager === 'pnpm') {
      const { updatedGraph: prunedGraph, combinedDependencies } =
        pruneProjectGraph(graph, packageJson);
      const updatedPackageJson = createNewPackageJson(
        normalizedPackageJson,
        combinedDependencies
      );
      return stringifyPnpmLockfile(prunedGraph, content, updatedPackageJson);
    }
    if (packageManager === 'npm') {
      const { updatedGraph: prunedGraph, combinedDependencies } =
        pruneProjectGraph(graph, packageJson);
      const updatedPackageJson = createNewPackageJson(
        normalizedPackageJson,
        combinedDependencies
      );
      return stringifyNpmLockfile(prunedGraph, content, updatedPackageJson);
    }
    if (packageManager === 'bun') {
      output.log({
        title:
          "Unable to create bun lock files. Run bun install it's just as quick",
      });
    }
  } catch (e) {
    const additionalInfo = [
      'To prevent the build from breaking we are returning the root lock file.',
    ];
    if (packageManager === 'npm') {
      additionalInfo.push(
        'If you run `npm install --package-lock-only` in your output folder it will regenerate the correct pruned lockfile.'
      );
    }
    if (packageManager === 'pnpm') {
      additionalInfo.push(
        'If you run `pnpm install --lockfile-only` in your output folder it will regenerate the correct pruned lockfile.'
      );
    }
    output.error({
      title: 'An error occured while creating pruned lockfile',
      bodyLines: errorBodyLines(e, additionalInfo),
    });

    return content;
  }
}

function createNewPackageJson(
  packageJson: PackageJson,
  combinedDependencies: Record<string, string>
): PackageJson {
  for (const [key, value] of Object.entries(combinedDependencies)) {
    if (packageJson.dependencies[key]) {
      packageJson.dependencies[key] = value;
    } else if (packageJson.devDependencies[key]) {
      packageJson.devDependencies[key] = value;
    } else if (packageJson.optionalDependencies[key]) {
      packageJson.optionalDependencies[key] = value;
    } else if (packageJson.peerDependencies[key]) {
      packageJson.peerDependencies[key] = value;
    }
  }
  return packageJson;
}

function errorBodyLines(originalError: Error, additionalInfo: string[] = []) {
  return [
    'Please open an issue at `https://github.com/nrwl/nx/issues/new?template=1-bug.yml` and provide a reproduction.',

    ...additionalInfo,

    `\nOriginal error: ${originalError.message}\n\n`,
    originalError.stack,
  ];
}
