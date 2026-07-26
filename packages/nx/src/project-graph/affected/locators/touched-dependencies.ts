import { minimatch } from 'minimatch';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import { FileChange } from '../../file-utils';
import { ProjectGraphExternalNode } from '../../../config/project-graph';
import { getPlugins } from '../../plugins/get-plugins';
import { LoadedNxPlugin } from '../../plugins/loaded-nx-plugin';
import { TouchedDependencyFile } from '../../plugins/public-api';
import { output } from '../../../utils/output';
import { workspaceRoot } from '../../../utils/workspace-root';
import { readNxJson } from '../../../config/configuration';

/**
 * Lets a plugin attribute changes in a centralized dependency manifest (a lock file, a Central
 * Package Management `Directory.Packages.props`, a version catalog) to the specific external
 * dependencies that changed, so only the projects consuming them are marked affected.
 *
 * Returns external node names; the reverse-graph traversal in `filterAffected` walks from those
 * back to the workspace projects that depend on them. Fallback paths return project names
 * directly, following the same convention as `getTouchedNpmPackages`.
 */
export const getTouchedDependencies: TouchedProjectLocator = async (
  fileChanges,
  projectGraphNodes,
  nxJson,
  _packageJson,
  projectGraph
): Promise<string[]> => {
  const nxJsonConfiguration = nxJson ?? readNxJson();

  let plugins: LoadedNxPlugin[];
  try {
    plugins = (await getPlugins(nxJsonConfiguration)).filter(
      (p) => p.createTouchedDependencies
    );
  } catch {
    // Graph construction already surfaces plugin resolution failures.
    return [];
  }

  if (!plugins.length) {
    return [];
  }

  // Fall back to the graph's nodes so the mark-everything paths stay conservative even if a
  // caller omits the optional projectGraphNodes argument.
  const allProjectNames = Object.keys(
    projectGraphNodes ?? projectGraph?.nodes ?? {}
  );
  const externalNodes = projectGraph?.externalNodes ?? {};
  const touched = new Set<string>();

  for (const plugin of plugins) {
    const [manifestFilePattern, createTouchedDependencies] =
      plugin.createTouchedDependencies;

    const matchedFiles = fileChanges.filter((f) =>
      minimatch(f.file, manifestFilePattern, { dot: true })
    );
    if (!matchedFiles.length) {
      continue;
    }

    let result: Awaited<ReturnType<typeof createTouchedDependencies>>;
    try {
      result = await createTouchedDependencies(
        matchedFiles.map(toTouchedDependencyFile),
        { nxJsonConfiguration, workspaceRoot }
      );
    } catch (e) {
      output.warn({
        title: `"${plugin.name}" failed to determine which dependencies changed. All projects will be marked as affected.`,
        bodyLines: [e instanceof Error ? e.message : String(e)],
      });
      return allProjectNames;
    }

    if (result === '*') {
      return allProjectNames;
    }

    for (const identifier of result) {
      const nodeNames = findExternalNodeNames(identifier, externalNodes);
      if (!nodeNames.length) {
        // An unknown dependency might be consumed anywhere. This also over-selects when a
        // pinned-but-unreferenced package changes, but skipping those instead would turn any
        // mismatch between plugin-constructed identifiers and node names into silently missed
        // work — over-selecting is the recoverable side of that trade.
        return allProjectNames;
      }
      for (const nodeName of nodeNames) {
        touched.add(nodeName);
      }
    }
  }

  return Array.from(touched);
};

function toTouchedDependencyFile(change: FileChange): TouchedDependencyFile {
  return {
    file: change.file,
    baseContent: change.getContentAtBase?.() ?? null,
    headContent: change.getContentAtHead?.() ?? null,
  };
}

/**
 * Resolves a plugin-supplied identifier to external node names: exact node name first, then
 * `data.packageName`, mirroring how `externalDependencies` inputs are resolved. A package-name
 * match can return several nodes when the package is present at multiple versions.
 */
function findExternalNodeNames(
  identifier: string,
  externalNodes: Record<string, ProjectGraphExternalNode>
): string[] {
  // Own-property check: a package named e.g. `constructor` must not match the prototype chain.
  if (Object.prototype.hasOwnProperty.call(externalNodes, identifier)) {
    return [identifier];
  }

  const matches: string[] = [];
  for (const [name, node] of Object.entries(externalNodes)) {
    if (node.data?.packageName === identifier) {
      matches.push(name);
    }
  }
  return matches;
}
