import { isWholeFileChange, WholeFileChange } from '../../file-utils';
import {
  JsonDiffType,
  isJsonChange,
  JsonChange,
} from '../../../utils/json-diff';
import { logger } from '../../../utils/logger';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';

export const getTouchedNpmPackages: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, _, nxJson, packageJson, projectGraph) => {
  const packageJsonChange = touchedFiles.find((f) => f.file === 'package.json');
  if (!packageJsonChange) return new Map();

  let touched: Map<string, string[]> = new Map();
  const changes = packageJsonChange.getChanges();

  const npmPackages = Object.values(projectGraph.externalNodes);

  const missingTouchedNpmPackages: string[] = [];

  for (const c of changes) {
    if (
      isJsonChange(c) &&
      (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies') &&
      c.path.length === 2
    ) {
      // A package was deleted so mark all workspace projects as touched.
      if (c.type === JsonDiffType.Deleted) {
        touched = new Map(
          Object.values(projectGraph.nodes).map((n) => [
            n.name,
            [
              `A package was removed from package.json. This can affect any project.`,
            ],
          ])
        );
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
        const existing = touched.get(npmPackage.name);
        const message =
          'The package.json specification for this package was changed.';
        if (existing) {
          existing.push(message);
        } else {
          touched.set(npmPackage.name, [message]);
        }
        // If it was a type declarations package then also mark its corresponding implementation package as affected
        if (npmPackage.name.startsWith('npm:@types/')) {
          const implementationNpmPackage = npmPackages.find(
            (pkg) => pkg.data.packageName === c.path[1].substring(7)
          );
          if (implementationNpmPackage) {
            const existing = touched.get(implementationNpmPackage.name);
            const message = `The package.json specification for the @types/${implementationNpmPackage} package was changed.`;
            if (existing) {
              existing.push(message);
            } else {
              touched.set(implementationNpmPackage.name, [message]);
            }
          }
        }
      }
    } else if (isWholeFileChange(c)) {
      // Whole file was touched, so all npm packages are touched.
      touched = new Map(
        npmPackages.map((pkg) => [
          pkg.name,
          [
            'The package.json file detected a whole file change - this affects all NPM dependencies.',
          ],
        ])
      );
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
