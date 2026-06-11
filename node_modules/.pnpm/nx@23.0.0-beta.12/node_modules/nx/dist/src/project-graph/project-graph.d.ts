import { ProjectGraph } from '../config/project-graph';
import { ProjectConfiguration, ProjectsConfigurations } from '../config/workspace-json-project-json';
/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 *
 * @param {number} [minimumComputedAt] - The minimum timestamp that the cached ProjectGraph must have been computed at.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export declare function readCachedProjectGraph(minimumComputedAt?: number): ProjectGraph;
export declare function readCachedProjectConfiguration(projectName: string): ProjectConfiguration;
/**
 * Get the {@link ProjectsConfigurations} from the {@link ProjectGraph}
 */
export declare function readProjectsConfigurationFromProjectGraph(projectGraph: ProjectGraph): ProjectsConfigurations;
export declare function buildProjectGraphAndSourceMapsWithoutDaemon(): Promise<{
    projectGraph: ProjectGraph;
    sourceMaps: import("./utils/project-configuration/source-maps").ConfigurationSourceMaps;
}>;
export declare function handleProjectGraphError(opts: {
    exitOnError: boolean;
}, e: any): void;
/**
 * Computes and returns a ProjectGraph.
 *
 * Nx will compute the graph either in a daemon process or in the current process.
 *
 * Nx will compute it in the current process if:
 * * The process is running in CI (CI env variable is to true or other common variables used by CI providers are set).
 * * It is running in the docker container.
 * * The daemon process is disabled because of the previous error when starting the daemon.
 * * `NX_DAEMON` is set to `false`.
 * * `useDaemonProcess` is set to false in the options of the tasks runner inside `nx.json`
 *
 * `NX_DAEMON` env variable takes precedence:
 * * If it is set to true, the daemon will always be used.
 * * If it is set to false, the graph will always be computed in the current process.
 *
 * Tip: If you want to debug project graph creation, run your command with NX_DAEMON=false.
 *
 * Nx uses two layers of caching: the information about explicit dependencies stored on the disk and the information
 * stored in the daemon process. To reset both run: `nx reset`.
 */
export declare function createProjectGraphAsync(opts?: {
    exitOnError: boolean;
    resetDaemonClient?: boolean;
}): Promise<ProjectGraph>;
export declare function createProjectGraphAndSourceMapsAsync(opts?: {
    exitOnError: boolean;
    resetDaemonClient?: boolean;
}): Promise<{
    projectGraph: any;
    sourceMaps: any;
}>;
export declare function preventRecursionInGraphConstruction(): void;
