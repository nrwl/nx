import { join } from 'path';
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
import { ExternalDependenciesCache } from './build-dependencies';
import { satisfies } from 'semver';

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

    // Preprocess relevant external nodes for the given deps for optimal traversal
    let fallbackExternalNodeVersion: string | undefined;
    const depToRelevantExternalNodes = new Map<string, string[]>();
    for (const externalNode of Object.keys(ctx.externalNodes)) {
      const [depName] = externalNode.match(/^npm:(.*)/)?.[1].split('@') ?? [];
      if (!deps[depName]) {
        continue;
      }
      if (!depToRelevantExternalNodes.has(depName)) {
        depToRelevantExternalNodes.set(depName, []);
      }
      const isFallback = !externalNode.includes('@');
      if (isFallback) {
        fallbackExternalNodeVersion =
          ctx.externalNodes[externalNode].data.version;
      }
      depToRelevantExternalNodes.get(depName).push(
        // For the fallback external node with no version, add the version so that we can more accurately match it later
        isFallback
          ? `${externalNode}@${fallbackExternalNodeVersion}`
          : externalNode
      );
    }

    // the name matches the import path
    Object.entries(deps).forEach(([d, version]) => {
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
        return;
      }

      /**
       * For external (npm) packages we need to match them as accurately and granularly as possible:
       * - If the package.json specifies an exact version, we can match that directly.
       * - If the package.json specifies something other than an exact version, we need to look up
       * possible matching nodes from the graph.
       * - If we have not found any matches yet, we may still have a node containing only the package name
       * as a fallback.
       */

      const externalWithExactVersion = `npm:${d}@${version}`;

      if (ctx.externalNodes[externalWithExactVersion]) {
        applyDependencyTarget(externalWithExactVersion);
        return;
      }

      const externalWithNoVersion = `npm:${d}`;

      const relevantExternalNodes = depToRelevantExternalNodes.get(d);
      if (relevantExternalNodes?.length > 0) {
        // Nodes will already be in the order of highest version first, so the match should be most appropriate
        for (const node of relevantExternalNodes) {
          // see if the version is compatible
          const [_, externalDepVersion] = node.split('@');
          if (satisfies(externalDepVersion, version)) {
            applyDependencyTarget(
              externalDepVersion === fallbackExternalNodeVersion
                ? externalWithNoVersion
                : node
            );
            return;
          }
        }
      }

      if (ctx.externalNodes[externalWithNoVersion]) {
        applyDependencyTarget(externalWithNoVersion);
        return;
      }
    });
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(e);
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
