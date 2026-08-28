import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { locateTouchedProjects } from '../../native';
import { getPlugins } from '../plugins/get-plugins';
import { getGlobPatternsOfPlugins } from '../utils/retrieve-workspace-files';
import { workspaceRoot } from '../../utils/workspace-root';
import { FileChange } from '../file-utils';
import { getTouchedProjects as getJSTouchedProjects } from '../../plugins/js/project-graph/affected/touched-projects';
import { marshalGraph } from './marshal-graph';

/** Which locator marked a project touched. PR 2 deepens this into a reason. */
export interface TouchedProject {
  project: string;
  locator: string;
}

/**
 * Runs every locator and returns what each one marked, duplicates included.
 *
 * Provenance is captured here rather than inside `TouchedProjectLocator`, whose
 * `string[]` return the four JS-plugin locators still use.
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
  return native.map((project) => ({ project, locator: 'native' }));
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
