import {
  isWholeFileChange,
  WholeFileChange,
} from '../../../../project-graph/file-utils';
import {
  JsonDiffType,
  isJsonChange,
  JsonChange,
} from '../../../../utils/json-diff';
import { logger } from '../../../../utils/logger';
import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import { getPackageNameFromImportPath } from '../../../../utils/get-package-name-from-import-path';

export const getTouchedNpmPackages: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, _, nxJson, packageJson, projectGraph): string[] => {
  const packageJsonChange = touchedFiles.find((f) => f.file === 'package.json');
  if (!packageJsonChange) return [];

  const globalPackages = new Set(getGlobalPackages(nxJson.plugins));

  let touched = [];
  const changes = packageJsonChange.getChanges();

  const npmPackages = Object.values(projectGraph.externalNodes);
  let packagesByName: Map<string, ProjectGraphExternalNode[]> | undefined;

  const missingTouchedNpmPackages: string[] = [];

  for (const c of changes) {
    if (
      isJsonChange(c) &&
      (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies') &&
      c.path.length === 2
    ) {
      // A package was deleted so mark all workspace projects as touched.
      if (c.type === JsonDiffType.Deleted) {
        touched = Object.keys(projectGraph.nodes);
        break;
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
            return Object.keys(projectGraph.nodes);
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
        packagesByName
      );

      // An unresolved selector can still target a transitive dependency,
      // so fall back to marking every project affected.
      if (!matchingNpmPackages.length) {
        return Object.keys(projectGraph.nodes);
      }

      if (
        matchingNpmPackages.some((pkg) =>
          globalPackages.has(pkg.data.packageName)
        )
      ) {
        return Object.keys(projectGraph.nodes);
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
};

function getPackageSelector(change: JsonChange): string | undefined {
  const value =
    change.type === JsonDiffType.Deleted ? change.value.lhs : change.value.rhs;
  if (typeof value !== 'string') return;

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
  packagesByName: Map<string, ProjectGraphExternalNode[]>
): ProjectGraphExternalNode[] {
  let match: { packageName: string; end: number } | undefined;

  for (const packageName of packagesByName.keys()) {
    let index = selector.indexOf(packageName);
    while (index !== -1) {
      const end = index + packageName.length;
      const validStart =
        index === 0 ||
        selector[index - 1] === '>' ||
        selector[index - 1] === '/';
      const validEnd = end === selector.length || selector[end] === '@';

      if (
        validStart &&
        validEnd &&
        (!match ||
          end > match.end ||
          (end === match.end && packageName.length > match.packageName.length))
      ) {
        match = { packageName, end };
      }
      index = selector.indexOf(packageName, index + 1);
    }
  }

  return match ? packagesByName.get(match.packageName) : [];
}

function getGlobalPackages(plugins: NxJsonConfiguration['plugins']) {
  return (plugins ?? [])
    .map((p) =>
      getPackageNameFromImportPath(typeof p === 'string' ? p : p.plugin)
    )
    .concat('nx');
}
