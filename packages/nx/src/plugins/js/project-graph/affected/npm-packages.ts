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

  // Build lookup maps once for O(1) access instead of O(n) .find() per change
  const npmPackagesByPackageName = new Map<string, ProjectGraphExternalNode>();
  for (const pkg of Object.values(projectGraph.externalNodes)) {
    npmPackagesByPackageName.set(pkg.data.packageName, pkg);
  }

  const projectNodesByName = new Map<string, ProjectGraphProjectNode>();
  for (const node of Object.values(projectGraph.nodes)) {
    projectNodesByName.set(node.name, node);
  }

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
        // O(1) lookup instead of O(n) .find()
        let npmPackage: ProjectGraphProjectNode | ProjectGraphExternalNode =
          npmPackagesByPackageName.get(c.path[1] as string);
        if (!npmPackage) {
          // dependency can also point to a workspace project
          npmPackage = projectNodesByName.get(c.path[1] as string);
        }
        if (!npmPackage) {
          missingTouchedNpmPackages.push(c.path[1]);
          continue;
        }
        touched.push(npmPackage.name);
        // If it was a type declarations package then also mark its corresponding implementation package as affected
        if (npmPackage.name.startsWith('npm:@types/')) {
          // O(1) lookup instead of O(n) .find()
          const implementationNpmPackage = npmPackagesByPackageName.get(
            (c.path[1] as string).substring(7)
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
    } else if (isWholeFileChange(c)) {
      // Whole file was touched, so all npm packages are touched.
      touched = Object.keys(projectGraph.externalNodes);
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
  return touched;
};

function getGlobalPackages(plugins: NxJsonConfiguration['plugins']) {
  return (plugins ?? [])
    .map((p) =>
      getPackageNameFromImportPath(typeof p === 'string' ? p : p.plugin)
    )
    .concat('nx');
}
