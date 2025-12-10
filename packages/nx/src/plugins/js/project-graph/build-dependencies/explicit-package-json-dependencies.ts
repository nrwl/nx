import { DependencyType } from '../../../../config/project-graph';
import { defaultFileRead } from '../../../../project-graph/file-utils';
import type { CreateDependenciesContext } from '../../../../project-graph/plugins';
import {
  type RawProjectGraphDependency,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';
import { parseJson } from '../../../../utils/json';
import type { PackageJson } from '../../../../utils/package-json';
import { joinPathFragments } from '../../../../utils/path';
import { TargetProjectLocator } from './target-project-locator';

export function buildExplicitPackageJsonDependencies(
  ctx: CreateDependenciesContext,
  targetProjectLocator: TargetProjectLocator
): RawProjectGraphDependency[] {
  const res: RawProjectGraphDependency[] = [];
  // Build Set of valid package.json paths once for O(1) lookup
  // instead of O(n) find() per file
  const projectPackageJsonPaths = new Set(
    Object.values(ctx.projects).map((project) =>
      joinPathFragments(project.root, 'package.json')
    )
  );

  for (const source in ctx.filesToProcess.projectFileMap) {
    for (const f of Object.values(ctx.filesToProcess.projectFileMap[source])) {
      if (projectPackageJsonPaths.has(f.file)) {
        processPackageJson(source, f.file, ctx, targetProjectLocator, res);
      }
    }
  }
  return res;
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

    for (const [packageName, packageVersion] of Object.entries(deps)) {
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
        continue;
      }

      const externalNodeName = targetProjectLocator.findNpmProjectFromImport(
        packageName,
        packageJsonPath
      );
      if (!externalNodeName) {
        continue;
      }

      const dependency: RawProjectGraphDependency = {
        source: sourceProject,
        target: externalNodeName,
        sourceFile: packageJsonPath,
        type: DependencyType.static,
      };
      validateDependency(dependency, ctx);
      collectedDeps.push(dependency);
    }
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
    for (const [depName, depVersion] of Object.entries(
      packageJson[type] || {}
    )) {
      deps[depName] = depVersion;
    }
  }

  return deps;
}
