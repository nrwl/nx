import type {
  ProjectConfiguration,
  ProjectsConfigurations,
  Workspace,
} from './workspace-json-project-json';
import { NxJsonConfiguration } from './nx-json';

/**
 * Some metadata about a file
 */
export interface FileData {
  file: string;
  hash: string;
  /**
   * An array of dependencies. If an element is just a string,
   * the dependency is assumed to be a static dependency targetting
   * that string. If the element is a tuple with two elements, the first element
   * inside of it is the target project, with the second element being the type of dependency.
   * If the tuple has 3 elements, the first is preceded by a source.
   */
  deps?: FileDataDependency[];
}

/**
 * A file data dependency, as stored in the cache. If just a string,
 * the dependency is assumed to be a static dependency targetting
 * that string. If it is a tuple with two elements, the first element
 * inside of it is the target project, with the second element being the type of dependency.
 * If the tuple has 3 elements, the first is preceded by a source.
 */
export type FileDataDependency =
  | string
  | [target: string, type: DependencyType]
  | [source: string, target: string, type: DependencyType];

export function fileDataDepTarget(dep: FileDataDependency) {
  return typeof dep === 'string'
    ? dep
    : Array.isArray(dep) && dep.length === 2
    ? dep[0]
    : dep[1];
}

export function fileDataDepType(dep: FileDataDependency) {
  return typeof dep === 'string'
    ? 'static'
    : Array.isArray(dep) && dep.length === 2
    ? dep[1]
    : dep[2];
}

export interface FileMap {
  nonProjectFiles: FileData[];
  projectFileMap: ProjectFileMap;
}

/**
 * A list of files separated by the project they belong to
 */
export interface ProjectFileMap {
  [projectName: string]: FileData[];
}

/**
 * A Graph of projects in the workspace and dependencies between them
 */
export interface ProjectGraph {
  nodes: Record<string, ProjectGraphProjectNode>;
  externalNodes?: Record<string, ProjectGraphExternalNode>;
  dependencies: Record<string, ProjectGraphDependency[]>;
  version?: string;
}

/**
 * Type of dependency between projects
 */
export enum DependencyType {
  /**
   * Static dependencies are tied to the loading of the module
   */
  static = 'static',
  /**
   * Dynamic dependencies are brought in by the module at run time
   */
  dynamic = 'dynamic',
  /**
   * Implicit dependencies are inferred
   */
  implicit = 'implicit',
}

/**
 * A node describing a project in a workspace
 */
export interface ProjectGraphProjectNode {
  type: 'app' | 'e2e' | 'lib';
  name: string;
  /**
   * Additional metadata about a project
   */
  data: ProjectConfiguration & {
    description?: string;
  };
}

/**
 * A node describing an external dependency
 * `name` has as form of:
 * - `npm:packageName` for root dependencies or
 * - `npm:packageName@version` for nested transitive dependencies
 *
 * This is vital for our node discovery to always point to root dependencies,
 * while allowing tracking of the full tree of different nested versions
 *
 */
export interface ProjectGraphExternalNode {
  type: 'npm';
  name: `npm:${string}`;
  data: {
    version: string;
    packageName: string;
    hash?: string;
  };
}

/**
 * A dependency between two projects
 */
export interface ProjectGraphDependency {
  type: DependencyType | string;
  /**
   * The project being imported by the other
   */
  target: string;
  /**
   * The project importing the other
   */
  source: string;
}

/**
 * Additional information to be used to process a project graph
 * @deprecated The {@link ProjectGraphProcessor} is deprecated. This will be removed in Nx 20.
 */
export interface ProjectGraphProcessorContext {
  /**
   * Workspace information such as projects and configuration
   * @deprecated use {@link projectsConfigurations} or {@link nxJsonConfiguration} instead
   */
  workspace: Workspace;

  projectsConfigurations: ProjectsConfigurations;

  nxJsonConfiguration: NxJsonConfiguration;

  /**
   * All files in the workspace
   */
  fileMap: ProjectFileMap;

  /**
   * Files changes since last invocation
   */
  filesToProcess: ProjectFileMap;
}

/**
 * A function that produces an updated ProjectGraph
 * @deprecated Use {@link CreateNodes} and {@link CreateDependencies} instead. This will be removed in Nx 20.
 */
export type ProjectGraphProcessor = (
  currentGraph: ProjectGraph,
  context: ProjectGraphProcessorContext
) => ProjectGraph | Promise<ProjectGraph>;
