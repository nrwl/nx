import {
  FileChange,
  isWholeFileChange,
  WholeFileChange,
} from '../../../../project-graph/file-utils';
import {
  JsonDiffType,
  isJsonChange,
  JsonChange,
} from '../../../../utils/json-diff';
import { logger } from '../../../../utils/logger';
import {
  DependencyChanges,
  TouchedProjectLocator,
} from '../../../../project-graph/affected/affected-project-graph-models';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import { getPackageNameFromImportPath } from '../../../../utils/get-package-name-from-import-path';

export const getTouchedNpmPackages: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, _nodes, nxJson, _packageJson, projectGraph): string[] =>
  touchedNpmPackages(touchedFiles, nxJson, projectGraph) ??
  Object.keys(projectGraph.nodes);

/**
 * The same change as task selection consumes it: the packages that moved,
 * which a plan names as `External`, and the workspace projects the root
 * package.json depends on directly.
 */
export function packageJsonDependencyChanges(
  touchedFiles: FileChange<WholeFileChange | JsonChange>[],
  nxJson: NxJsonConfiguration,
  projectGraph: ProjectGraph
): DependencyChanges {
  const touched = touchedNpmPackages(touchedFiles, nxJson, projectGraph);
  if (touched === null) {
    return { externals: [], changedExternalTypes: ['npm'], projects: [] };
  }
  return {
    externals: touched.filter((name) => name in projectGraph.externalNodes),
    changedExternalTypes: [],
    projects: touched.filter((name) => name in projectGraph.nodes),
  };
}

const PNPM_WORKSPACE_FILES = ['pnpm-workspace.yaml', 'pnpm-workspace.yml'];

/**
 * External nodes and workspace projects the root package.json change names,
 * or null when it cannot be pinned to them: a removed dependency, a global
 * package, or an override selector matching nothing in the graph.
 *
 * Also reads `overrides` from `pnpm-workspace.yaml` (pnpm 10+): the field
 * moves there when the root `package.json` has no `pnpm` block, and pnpm 12
 * no longer reads `package.json#pnpm` at all. Yaml override diffs are rewritten
 * to the `pnpm.overrides.*` path and matched by the existing pnpm selector
 * logic. Catalog and other workspace settings are left alone.
 */
function touchedNpmPackages(
  touchedFiles: FileChange<WholeFileChange | JsonChange>[],
  nxJson: NxJsonConfiguration,
  projectGraph: ProjectGraph
): string[] | null {
  const packageJsonChange = touchedFiles.find((f) => f.file === 'package.json');
  const workspaceYamlChange = touchedFiles.find((f) =>
    PNPM_WORKSPACE_FILES.includes(f.file)
  );
  if (!packageJsonChange && !workspaceYamlChange) return [];

  const globalPackages = new Set(getGlobalPackages(nxJson.plugins));

  let touched = [];
  const changes: (WholeFileChange | JsonChange)[] = packageJsonChange
    ? [...packageJsonChange.getChanges()]
    : [];

  if (workspaceYamlChange) {
    for (const c of workspaceYamlChange.getChanges()) {
      // Unparseable yaml - be conservative and fall back to all projects.
      if (isWholeFileChange(c)) return null;
      if (!isJsonChange(c)) return null;

      // Catalog, patchedDependencies, settings, etc. do not change which
      // packages the lockfile resolves to.
      if (c.path[0] !== 'overrides') continue;

      // Replacing the whole `overrides` map with something non-mappy
      // (null, scalar, array) is a shape we don't understand - fall back.
      if (c.path.length === 1) {
        if (!isObjectOrUndefined(c.value.lhs)) return null;
        if (!isObjectOrUndefined(c.value.rhs)) return null;
      } else {
        // pnpm's workspace overrides take string selectors as keys and
        // string versions as leaves; a non-string leaf is a shape we
        // don't model.
        if (c.value.lhs !== undefined && typeof c.value.lhs !== 'string') {
          return null;
        }
        if (c.value.rhs !== undefined && typeof c.value.rhs !== 'string') {
          return null;
        }
      }

      changes.push({
        ...c,
        path: ['pnpm', 'overrides', ...c.path.slice(1)],
      });
    }
  }

  const npmPackages = Object.values(projectGraph.externalNodes);
  let packagesByName: Map<string, ProjectGraphExternalNode[]> | undefined;

  const missingTouchedNpmPackages: string[] = [];

  for (const c of changes) {
    if (
      isJsonChange(c) &&
      (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies') &&
      c.path.length === 2
    ) {
      if (c.type === JsonDiffType.Deleted) {
        return null;
      } else {
        let npmPackage: ProjectGraphProjectNode | ProjectGraphExternalNode =
          npmPackages.find((pkg) => pkg.data.packageName === c.path[1]);
        if (!npmPackage) {
          // dependency can also point to a workspace project
          const nodes = Object.values(projectGraph.nodes);
          npmPackage = nodes.find((n) => n.name === c.path[1]);
        }
        if (!npmPackage) {
          missingTouchedNpmPackages.push(c.path[1]);
          continue;
        }
        touched.push(npmPackage.name);
        // If it was a type declarations package then also mark its corresponding implementation package as affected
        if (npmPackage.name.startsWith('npm:@types/')) {
          const implementationNpmPackage = npmPackages.find(
            (pkg) => pkg.data.packageName === c.path[1].substring(7)
          );
          if (implementationNpmPackage) {
            touched.push(implementationNpmPackage.name);
          }
        }

        if ('packageName' in npmPackage.data) {
          if (globalPackages.has(npmPackage.data.packageName)) {
            return null;
          }
        }
      }
    } else if (
      isJsonChange(c) &&
      (c.path[0] === 'overrides' ||
        c.path[0] === 'resolutions' ||
        (c.path[0] === 'pnpm' && c.path[1] === 'overrides'))
    ) {
      const packageSelector = getPackageSelector(c);
      if (!packageSelector) continue;

      packagesByName ??= groupPackagesByName(npmPackages);
      const matchingNpmPackages = findPackagesForSelector(
        packageSelector,
        packagesByName,
        c.path[0] === 'pnpm'
      );

      // An unresolved selector can still target a transitive dependency.
      if (!matchingNpmPackages.length) {
        return null;
      }

      if (
        matchingNpmPackages.some((pkg) =>
          globalPackages.has(pkg.data.packageName)
        )
      ) {
        return null;
      }

      touched.push(...matchingNpmPackages.map((pkg) => pkg.name));
    } else if (isWholeFileChange(c)) {
      // Whole file was touched, so all npm packages are touched.
      touched = npmPackages.map((pkg) => pkg.name);
      break;
    }
  }

  if (missingTouchedNpmPackages.length) {
    logger.warn(
      `The affected projects might have not been identified properly. The package(s) ${missingTouchedNpmPackages.join(
        ', '
      )} were not found. Please open an issue in GitHub including the package.json file.`
    );
  }
  return [...new Set(touched)];
}

function getPackageSelector(change: JsonChange): string | undefined {
  if (
    typeof change.value.lhs !== 'string' &&
    typeof change.value.rhs !== 'string'
  ) {
    return;
  }

  const selectorIndex = change.path[0] === 'pnpm' ? 2 : change.path.length - 1;
  const selector = change.path[selectorIndex];
  return selector === '.' ? change.path[selectorIndex - 1] : selector;
}

function groupPackagesByName(
  npmPackages: ProjectGraphExternalNode[]
): Map<string, ProjectGraphExternalNode[]> {
  const packagesByName = new Map<string, ProjectGraphExternalNode[]>();
  for (const pkg of npmPackages) {
    const packageName = pkg.data.packageName;
    if (!packageName) continue;
    const packages = packagesByName.get(packageName);
    if (packages) {
      packages.push(pkg);
    } else {
      packagesByName.set(packageName, [pkg]);
    }
  }
  return packagesByName;
}

function findPackagesForSelector(
  selector: string,
  packagesByName: Map<string, ProjectGraphExternalNode[]>,
  isPnpmOverride: boolean
): ProjectGraphExternalNode[] {
  if (isPnpmOverride) {
    // Pnpm does not treat `>` as a parent delimiter when it starts a range.
    const parentDelimiterIndex = selector.search(/[^ |@]>/);
    if (parentDelimiterIndex !== -1) {
      selector = selector.slice(parentDelimiterIndex + 2);
    }
  }

  const packageName = selector.match(
    /(?:^|\/)(@[^/@>\s]+\/[^/@>\s]+|[^/@>\s]+)(?:@[^/]*)?$/
  )?.[1];

  return packageName ? (packagesByName.get(packageName) ?? []) : [];
}

function getGlobalPackages(plugins: NxJsonConfiguration['plugins']) {
  return (plugins ?? [])
    .map((p) =>
      getPackageNameFromImportPath(typeof p === 'string' ? p : p.plugin)
    )
    .concat('nx');
}

function isObjectOrUndefined(value: unknown): boolean {
  return (
    value === undefined ||
    (value !== null && typeof value === 'object' && !Array.isArray(value))
  );
}
