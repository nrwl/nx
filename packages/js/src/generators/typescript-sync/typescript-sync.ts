import {
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  readJson,
  readNxJson,
  writeJson,
  type ExpandedPluginConfiguration,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type Tree,
} from '@nx/devkit';
import { normalize, relative } from 'node:path/posix';
import {
  PLUGIN_NAME,
  type TscPluginOptions,
} from '../../plugins/typescript/plugin';
import type { SyncSchema } from './schema';

interface Tsconfig {
  references?: Array<{ path: string }>;
  compilerOptions?: {
    paths?: Record<string, string[]>;
    rootDir?: string;
    outDir?: string;
  };
}

const COMMON_RUNTIME_TS_CONFIG_FILE_NAMES = [
  'tsconfig.app.json',
  'tsconfig.lib.json',
  'tsconfig.build.json',
  'tsconfig.cjs.json',
  'tsconfig.esm.json',
  'tsconfig.runtime.json',
];

export async function syncGenerator(tree: Tree, options: SyncSchema) {
  // Ensure that the plugin has been wired up in nx.json
  const nxJson = readNxJson(tree);
  const tscPluginConfig:
    | string
    | ExpandedPluginConfiguration<TscPluginOptions> = nxJson.plugins.find(
    (p) => {
      if (typeof p === 'string') {
        return p === PLUGIN_NAME;
      }
      return p.plugin === PLUGIN_NAME;
    }
  );
  if (!tscPluginConfig) {
    throw new Error(
      `The ${PLUGIN_NAME} plugin must be added to the "plugins" array in nx.json before syncing tsconfigs`
    );
  }

  // Root tsconfig containing project references for the whole workspace
  const rootTsconfigPath = 'tsconfig.json';
  if (!tree.exists(rootTsconfigPath)) {
    throw new Error(`A "tsconfig.json" file must exist in the workspace root.`);
  }

  const rootTsconfig = readJson<Tsconfig>(tree, rootTsconfigPath);
  const projectGraph = await createProjectGraphAsync();

  const tsconfigProjectNodeValues = Object.values(projectGraph.nodes).filter(
    (node) => {
      const projectTsconfigPath = joinPathFragments(
        node.data.root,
        'tsconfig.json'
      );
      return tree.exists(projectTsconfigPath);
    }
  );

  // Track if any changes were made to the tsconfig files. We check the changes
  // made by this generator to know if the TS config is out of sync with the
  // project graph. Therefore, we don't format the files if there were no changes
  // to avoid potential format-only changes that can lead to false positives.
  let hasChanges = false;

  if (tsconfigProjectNodeValues.length > 0) {
    // Similarly, don't write to the file if there are no changes to avoid
    // unnecessary changes due to JSON serialization
    let hasRootTsconfigChanges = false;
    // Sync the root tsconfig references from the project graph (do not destroy existing references)
    rootTsconfig.references = rootTsconfig.references || [];
    const referencesSet = new Set(
      rootTsconfig.references.map((ref) => normalizeReferencePath(ref.path))
    );
    for (const node of tsconfigProjectNodeValues) {
      const normalizedPath = normalizeReferencePath(node.data.root);
      // Skip the root tsconfig itself
      if (node.data.root !== '.' && !referencesSet.has(normalizedPath)) {
        rootTsconfig.references.push({ path: `./${normalizedPath}` });
        hasChanges = hasRootTsconfigChanges = true;
      }
    }

    if (hasRootTsconfigChanges) {
      writeJson(tree, rootTsconfigPath, rootTsconfig);
    }
  }

  const runtimeTsConfigFileNames =
    (nxJson.sync?.generatorOptions?.['@nx/js:typescript-sync']
      ?.runtimeTsConfigFileNames as string[]) ??
    COMMON_RUNTIME_TS_CONFIG_FILE_NAMES;

  const collectedDependencies = new Map<string, ProjectGraphProjectNode[]>();
  for (const [name, data] of Object.entries(projectGraph.dependencies)) {
    if (name.startsWith('npm:') || !data.length) {
      continue;
    }

    // Get the source project nodes for the source and target
    const sourceProjectNode = projectGraph.nodes[name];

    // Find the relevant tsconfig file for the source project
    const sourceProjectTsconfigPath = joinPathFragments(
      sourceProjectNode.data.root,
      'tsconfig.json'
    );
    if (!tree.exists(sourceProjectTsconfigPath)) {
      console.warn(
        `Skipping project "${name}" as there is no tsconfig.json file found in the project root "${sourceProjectNode.data.root}"`
      );
      continue;
    }

    // Collect the dependencies of the source project
    const dependencies = collectProjectDependencies(
      tree,
      name,
      projectGraph,
      collectedDependencies
    );
    if (!dependencies.length) {
      continue;
    }

    for (const runtimeTsConfigFileName of runtimeTsConfigFileNames) {
      const runtimeTsConfigPath = joinPathFragments(
        sourceProjectNode.data.root,
        runtimeTsConfigFileName
      );
      if (!tree.exists(runtimeTsConfigPath)) {
        continue;
      }

      // Update project references for the runtime tsconfig
      hasChanges =
        updateTsConfigReferences(
          tree,
          runtimeTsConfigPath,
          dependencies,
          sourceProjectNode.data.root,
          runtimeTsConfigFileName,
          runtimeTsConfigFileNames
        ) || hasChanges;
    }

    // Update project references for the tsconfig.json file
    hasChanges =
      updateTsConfigReferences(
        tree,
        sourceProjectTsconfigPath,
        dependencies,
        sourceProjectNode.data.root
      ) || hasChanges;
  }

  if (hasChanges) {
    await formatFiles(tree);
  }
}

export default syncGenerator;

function updateTsConfigReferences(
  tree: Tree,
  tsConfigPath: string,
  dependencies: ProjectGraphProjectNode[],
  projectRoot: string,
  runtimeTsConfigFileName?: string,
  possibleRuntimeTsConfigFileNames?: string[]
): boolean {
  const tsConfig = readJson<Tsconfig>(tree, tsConfigPath);
  // We have at least one dependency so we can safely set it to an empty array if not already set
  tsConfig.references ??= [];
  const referencesSet = new Set(
    tsConfig.references.map((ref) => normalizeReferencePath(ref.path))
  );

  let hasChanges = false;
  for (const dep of dependencies) {
    // Ensure the project reference for the target is set
    let referencePath = dep.data.root;
    if (runtimeTsConfigFileName) {
      const runtimeTsConfigPath = joinPathFragments(
        dep.data.root,
        runtimeTsConfigFileName
      );
      if (tree.exists(runtimeTsConfigPath)) {
        referencePath = runtimeTsConfigPath;
      } else {
        // Check for other possible runtime tsconfig file names
        // TODO(leo): should we check if there are more than one runtime tsconfig files and throw an error?
        for (const possibleRuntimeTsConfigFileName of possibleRuntimeTsConfigFileNames ??
          []) {
          const possibleRuntimeTsConfigPath = joinPathFragments(
            dep.data.root,
            possibleRuntimeTsConfigFileName
          );
          if (tree.exists(possibleRuntimeTsConfigPath)) {
            referencePath = possibleRuntimeTsConfigPath;
            break;
          }
        }
      }
    }
    const relativePathToTargetRoot = relative(projectRoot, referencePath);
    if (!referencesSet.has(relativePathToTargetRoot)) {
      // Make sure we unshift rather than push so that dependencies are built in the right order by TypeScript when it is run directly from the root of the workspace
      tsConfig.references.unshift({ path: relativePathToTargetRoot });
      hasChanges = true;
    }
  }

  if (hasChanges) {
    writeJson(tree, tsConfigPath, tsConfig);
  }

  return hasChanges;
}

// Collect the dependencies of a project recursively sorted from root to leaf
function collectProjectDependencies(
  tree: Tree,
  projectName: string,
  projectGraph: ProjectGraph,
  collectedDependencies: Map<string, ProjectGraphProjectNode[]>
): ProjectGraphProjectNode[] {
  if (collectedDependencies.has(projectName)) {
    // We've already collected the dependencies for this project
    return collectedDependencies.get(projectName);
  }

  collectedDependencies.set(projectName, []);

  for (const dep of projectGraph.dependencies[projectName]) {
    const targetProjectNode = projectGraph.nodes[dep.target];
    if (!targetProjectNode) {
      // It's an external dependency
      continue;
    }

    // Add the target project node to the list of dependencies for the current project
    if (
      !collectedDependencies
        .get(projectName)
        .some((d) => d.name === targetProjectNode.name)
    ) {
      collectedDependencies.get(projectName).push(targetProjectNode);
    }

    // Recursively get the dependencies of the target project
    const transitiveDependencies = collectProjectDependencies(
      tree,
      dep.target,
      projectGraph,
      collectedDependencies
    );
    for (const transitiveDep of transitiveDependencies) {
      if (
        !collectedDependencies
          .get(projectName)
          .some((d) => d.name === transitiveDep.name)
      ) {
        collectedDependencies.get(projectName).push(transitiveDep);
      }
    }
  }

  return collectedDependencies.get(projectName);
}

// Normalize the paths to strip leading `./` and trailing `/tsconfig.json`
function normalizeReferencePath(path: string): string {
  return normalize(path)
    .replace(/\/tsconfig.json$/, '')
    .replace(/^\.\//, '');
}
