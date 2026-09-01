import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { locateTouchedProjects } from '../../native';
import { getPlugins } from '../plugins/get-plugins';
import { getGlobPatternsOfPlugins } from '../utils/retrieve-workspace-files';
import { workspaceRoot } from '../../utils/workspace-root';
import { FileChange } from '../file-utils';
import { getTouchedProjects as getJSTouchedProjects } from '../../plugins/js/project-graph/affected/touched-projects';
import { marshalGraph } from './marshal-graph';
import type { TouchedProject } from './affected-reasons';

export type { TouchedProject };

/**
 * Runs every locator and returns what each one marked, duplicates included.
 *
 * Each locator reports its own reason: `TouchedProjectLocator` returns
 * `TouchedProject[]`, and the native side returns the same shape. This only
 * bridges the napi type to the TypeScript one.
 */
export async function runTouchedProjectLocators(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration,
  packageJson?: any,
  projectDeletionAffectsAllProjects = true
): Promise<TouchedProject[]> {
  const native = await locateTouchedProjects(
    marshalGraph(graph),
    nxJson,
    touchedFiles.map((f) => f.file),
    {
      projectGlobPatterns: await getProjectGlobPatterns(nxJson),
      projectDeletionAffectsAllProjects,
      workspaceRoot,
    },
    // Takes only paths, so the closure carries the FileChange objects: their
    // lazy getChanges() cannot cross the native boundary.
    [
      async () =>
        getJSTouchedProjects(
          touchedFiles,
          graph.nodes,
          nxJson,
          packageJson,
          graph,
          projectDeletionAffectsAllProjects
        ),
    ]
  );
  // `kind` crosses napi as a bare string, so the union is asserted rather than
  // checked. The values come from the native constants and from the JS locators
  // this call passes in, which are the only producers; nothing validates that at
  // runtime, so a new locator kind has to be added to AffectedReasonKind by hand.
  return native as TouchedProject[];
}

/** Resolved here because `getPlugins` is async and starts plugin workers. */
export async function getProjectGlobPatterns(
  nxJson: NxJsonConfiguration
): Promise<string[]> {
  // TODO: We need a quicker way to get patterns that should not
  // require starting up plugin workers
  if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
    return [
      '**/package.json',
      '**/project.json',
      'project.json',
      'package.json',
    ];
  }
  const plugins = (await getPlugins(nxJson)).filter((p) => !!p.createNodes);
  return getGlobPatternsOfPlugins(plugins);
}
