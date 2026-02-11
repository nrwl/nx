import {
  createProjectGraphAsync,
  detectPackageManager,
  formatFiles,
  joinPathFragments,
  logger,
  parseJson,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type Tree,
} from '@nx/devkit';
import { applyEdits, modify } from 'jsonc-parser';
import type { SyncGeneratorResult } from 'nx/src/utils/sync-generators';

interface PackageJson {
  name?: string;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

type ChangeDetails = {
  added: Set<string>;
  removed: Set<string>;
};

export async function syncGenerator(tree: Tree): Promise<SyncGeneratorResult> {
  const projectGraph = await createProjectGraphAsync();
  const pm = detectPackageManager(tree.root);
  const versionString = pm === 'npm' ? '*' : 'workspace:*';

  // Build a set of all internal package names (from graph metadata) and
  // a map from package name to project node for reverse lookups.
  const internalPackageNames = new Set<string>();
  const projectToPackageName = new Map<string, string>();
  for (const node of Object.values(projectGraph.nodes)) {
    const packageName = node.data.metadata?.js?.packageName;
    if (packageName) {
      internalPackageNames.add(packageName);
      projectToPackageName.set(node.name, packageName);
    }
  }

  const changedFiles = new Map<string, ChangeDetails>();

  for (const projectName of Object.keys(projectGraph.dependencies)) {
    const sourceNode = projectGraph.nodes[projectName];
    if (!sourceNode || sourceNode.data.root === '.') {
      continue;
    }

    // The consumer must itself have a package name (i.e. a package.json with name)
    const sourcePackageName = projectToPackageName.get(projectName);
    if (!sourcePackageName) {
      continue;
    }

    const packageJsonPath = joinPathFragments(
      sourceNode.data.root,
      'package.json'
    );
    if (!tree.exists(packageJsonPath)) {
      continue;
    }

    // Collect the expected set of internal dependency package names
    const expectedInternalDeps = new Set<string>();
    for (const dep of projectGraph.dependencies[projectName]) {
      const targetNode = projectGraph.nodes[dep.target];
      if (!targetNode || dep.type === 'implicit') {
        continue;
      }
      const depPackageName = projectToPackageName.get(dep.target);
      if (depPackageName) {
        expectedInternalDeps.add(depPackageName);
      }
    }

    // Read current package.json
    const rawContents = tree.read(packageJsonPath, 'utf-8');
    const packageJson = parseJson<PackageJson>(rawContents);
    const currentDevDeps = packageJson.devDependencies ?? {};

    let hasChanges = false;
    let updatedContents = rawContents;

    // Add missing internal devDependencies
    for (const depName of expectedInternalDeps) {
      if (
        currentDevDeps[depName] === versionString ||
        packageJson.dependencies?.[depName]
      ) {
        // Already present with correct version in devDeps, or listed in
        // regular dependencies — skip.
        continue;
      }

      if (currentDevDeps[depName] !== undefined) {
        // Present but wrong version string — update it
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          logger.info(
            `Updating devDependency "${depName}" version to "${versionString}" in ${packageJsonPath}.`
          );
        }
      }

      const edits = modify(
        updatedContents,
        ['devDependencies', depName],
        versionString,
        {
          formattingOptions: {
            keepLines: true,
            insertSpaces: true,
            tabSize: 2,
          },
        }
      );
      updatedContents = applyEdits(updatedContents, edits);
      hasChanges = true;
      addChange(changedFiles, packageJsonPath, depName, 'added');
    }

    // Remove stale internal devDependencies (internal packages no longer
    // depended on according to the project graph)
    for (const depName of Object.keys(currentDevDeps)) {
      if (
        internalPackageNames.has(depName) &&
        !expectedInternalDeps.has(depName)
      ) {
        const edits = modify(
          updatedContents,
          ['devDependencies', depName],
          undefined,
          {
            formattingOptions: {
              keepLines: true,
              insertSpaces: true,
              tabSize: 2,
            },
          }
        );
        updatedContents = applyEdits(updatedContents, edits);
        hasChanges = true;
        addChange(changedFiles, packageJsonPath, depName, 'removed');
      }
    }

    if (hasChanges) {
      tree.write(packageJsonPath, updatedContents);
    }
  }

  if (changedFiles.size > 0) {
    await formatFiles(tree);

    const outOfSyncDetails: string[] = [];
    for (const [filePath, details] of changedFiles) {
      outOfSyncDetails.push(`${filePath}:`);
      if (details.added.size > 0) {
        outOfSyncDetails.push(
          `  - Missing devDependencies: ${Array.from(details.added).join(', ')}`
        );
      }
      if (details.removed.size > 0) {
        outOfSyncDetails.push(
          `  - Stale devDependencies: ${Array.from(details.removed).join(', ')}`
        );
      }
    }

    return {
      outOfSyncMessage:
        'Some package.json files are missing devDependencies to internal packages they depend on or contain stale devDependencies to internal packages they no longer depend on.',
      outOfSyncDetails,
    };
  }
}

export default syncGenerator;

function addChange(
  changedFiles: Map<string, ChangeDetails>,
  filePath: string,
  depName: string,
  type: keyof ChangeDetails
): void {
  if (!changedFiles.has(filePath)) {
    changedFiles.set(filePath, {
      added: new Set(),
      removed: new Set(),
    });
  }
  changedFiles.get(filePath)![type].add(depName);
}
