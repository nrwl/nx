import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DependencyType } from '../../../../config/project-graph';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../../../config/workspace-json-project-json';
import { defaultFileRead } from '../../../../project-graph/file-utils';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';
import { parseJson } from '../../../../utils/json';
import { PackageJson } from '../../../../utils/package-json';
import { joinPathFragments } from '../../../../utils/path';
import { findExternalPackageJsonPath } from '../../utils/find-external-package-json-path';
import { ExternalDependenciesCache } from './build-dependencies';

export function buildExplicitPackageJsonDependencies(
  ctx: CreateDependenciesContext,
  externalDependenciesCache: ExternalDependenciesCache
): RawProjectGraphDependency[] {
  const res: RawProjectGraphDependency[] = [];
  let packageNameMap = undefined;
  const nodes = Object.values(ctx.projects);
  Object.keys(ctx.filesToProcess.projectFileMap).forEach((source) => {
    Object.values(ctx.filesToProcess.projectFileMap[source]).forEach((f) => {
      if (isPackageJsonAtProjectRoot(nodes, f.file)) {
        // we only create the package name map once and only if a package.json file changes
        packageNameMap = packageNameMap || createPackageNameMap(ctx.projects);
        processPackageJson(
          source,
          f.file,
          ctx,
          externalDependenciesCache,
          res,
          packageNameMap
        );
      }
    });
  });
  return res;
}

function createPackageNameMap(projects: ProjectsConfigurations['projects']) {
  const res = {};
  for (let projectName of Object.keys(projects)) {
    try {
      const packageJson = parseJson(
        defaultFileRead(join(projects[projectName].root, 'package.json'))
      );
      res[packageJson.name ?? projectName] = projectName;
    } catch (e) {}
  }
  return res;
}

function isPackageJsonAtProjectRoot(
  nodes: ProjectConfiguration[],
  fileName: string
) {
  return (
    fileName.endsWith('package.json') &&
    nodes.find(
      (projectNode) =>
        joinPathFragments(projectNode.root, 'package.json') === fileName
    )
  );
}

// package.json path => package.json contents to avoid reading the same file multiple times from disk
const externalPackageJsonCache = new Map<string, PackageJson>();

function processPackageJson(
  sourceProject: string,
  fileName: string,
  ctx: CreateDependenciesContext,
  externalDependenciesCache: ExternalDependenciesCache,
  collectedDeps: RawProjectGraphDependency[],
  packageNameMap: { [packageName: string]: string }
) {
  try {
    const deps = readDeps(parseJson(defaultFileRead(fileName)));

    function applyDependencyTarget(target: string) {
      const dependency: RawProjectGraphDependency = {
        source: sourceProject,
        target: target,
        sourceFile: fileName,
        type: DependencyType.static,
      };
      validateDependency(dependency, ctx);
      collectedDeps.push(dependency);
      const depsForSource =
        externalDependenciesCache.get(sourceProject) || new Set();
      depsForSource.add(dependency.target);
      externalDependenciesCache.set(sourceProject, depsForSource);
    }

    for (const d of Object.keys(deps)) {
      // package.json refers to another project in the monorepo
      if (packageNameMap[d]) {
        const dependency: RawProjectGraphDependency = {
          source: sourceProject,
          target: packageNameMap[d],
          sourceFile: fileName,
          type: DependencyType.static,
        };
        validateDependency(dependency, ctx);
        collectedDeps.push(dependency);
        continue;
      }

      try {
        // package.json refers to an external package, we do not match against the version found in there, we instead try and resolve the relevant package how node would
        let externalPackageVersion: string | undefined;
        const externalPackageJsonPath = findExternalPackageJsonPath(
          d,
          dirname(fileName)
        );
        // The package.json path might be not be resolvable, e.g. if a reference has been added to the package.json, but the install command has not been run yet.
        if (!externalPackageJsonPath) {
          continue;
        }
        if (!externalPackageJsonCache.has(externalPackageJsonPath)) {
          const externalPackageJson = parseJson(
            readFileSync(externalPackageJsonPath, 'utf-8')
          );
          externalPackageJsonCache.set(
            externalPackageJsonPath,
            externalPackageJson
          );
          externalPackageVersion = externalPackageJson.version;
        } else {
          externalPackageVersion = externalPackageJsonCache.get(
            externalPackageJsonPath
          ).version;
        }

        const externalWithExactVersion = `npm:${d}@${externalPackageVersion}`;
        if (ctx.externalNodes[externalWithExactVersion]) {
          applyDependencyTarget(externalWithExactVersion);
          continue;
        }

        const externalWithNoVersion = `npm:${d}`;
        if (ctx.externalNodes[externalWithNoVersion]) {
          applyDependencyTarget(externalWithNoVersion);
          continue;
        }
      } catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.error(e);
        }
      }
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
