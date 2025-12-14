import { DependencyType } from '../../../../config/project-graph';
import { defaultFileRead } from '../../../../project-graph/file-utils';
import type { CreateDependenciesContext } from '../../../../project-graph/plugins';
import {
  type RawProjectGraphDependency,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';
import { parseJson } from '../../../../utils/json';
import type { PackageJson } from '../../../../utils/package-json';
import { TargetProjectLocator } from './target-project-locator';

export function buildExplicitPackageJsonDependencies(
  ctx: CreateDependenciesContext,
  targetProjectLocator: TargetProjectLocator
): RawProjectGraphDependency[] {
  const res: RawProjectGraphDependency[] = [];
  const roots = {};
  Object.values(ctx.projects).forEach((project) => {
    roots[project.root] = true;
  });

  Object.keys(ctx.filesToProcess.projectFileMap).forEach((source) => {
    Object.values(ctx.filesToProcess.projectFileMap[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(roots, f.file)) {
        processPackageJson(source, f.file, ctx, targetProjectLocator, res);
      }
    });
  });
  return res;
}

function isPackageJsonAtProjectRoot(
  roots: Record<string, boolean>,
  fileName: string
) {
  if (!fileName.endsWith('package.json')) {
    return false;
  }
  const filePath = fileName.slice(0, -13);
  return !!roots[filePath];
}

function processPackageJson(
  sourceProject: string,
  packageJsonPath: string,
  ctx: CreateDependenciesContext,
  targetProjectLocator: TargetProjectLocator,
  collectedDeps: RawProjectGraphDependency[]
) {
  try {
    const deps = readDeps(parseJson(defaultFileRead(packageJsonPath)));

    Object.keys(deps).forEach((packageName) => {
      const packageVersion = deps[packageName];
      const localProject =
        targetProjectLocator.findDependencyInWorkspaceProjects(
          packageJsonPath,
          packageName,
          packageVersion
        );
      if (localProject) {
        // package.json refers to another project in the monorepo
        const dependency: RawProjectGraphDependency = {
          source: sourceProject,
          target: localProject,
          sourceFile: packageJsonPath,
          type: DependencyType.static,
        };
        validateDependency(dependency, ctx);
        collectedDeps.push(dependency);
        return;
      }

      const externalNodeName = targetProjectLocator.findNpmProjectFromImport(
        packageName,
        packageJsonPath
      );
      if (!externalNodeName) {
        return;
      }

      const dependency: RawProjectGraphDependency = {
        source: sourceProject,
        target: externalNodeName,
        sourceFile: packageJsonPath,
        type: DependencyType.static,
      };
      validateDependency(dependency, ctx);
      collectedDeps.push(dependency);
    });
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
  }
}

function readDeps(packageJson: PackageJson) {
  const deps: Record<string, string> = {};

  /**
   * We process dependencies in a rough order of increasing importance such that if a dependency is listed in multiple
   * sections, the version listed under the "most important" one wins, with production dependencies being the most important.
   */
  const depType = [
    'optionalDependencies',
    'peerDependencies',
    'devDependencies',
    'dependencies',
  ] as const;

  for (const type of depType) {
    Object.keys(packageJson[type] || {}).forEach((depName) => {
      deps[depName] = packageJson[type][depName];
    });
  }

  return deps;
}
