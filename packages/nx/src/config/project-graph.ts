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
  deps?: (string | [string, string])[];
}

export function fileDataDepTarget(dep: string | [string, string]) {
  return typeof dep === 'string' ? dep : dep[0];
}

export function fileDataDepType(dep: string | [string, string]) {
  return typeof dep === 'string' ? 'static' : dep[1];
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

/** @deprecated this type will be removed in v16. Use {@link ProjectGraphProjectNode} or {@link ProjectGraphExternalNode} instead */
export type ProjectGraphNode =
  | ProjectGraphProjectNode
  | ProjectGraphExternalNode;

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
 */
export type ProjectGraphProcessor = (
  currentGraph: ProjectGraph,
  context: ProjectGraphProcessorContext
) => ProjectGraph | Promise<ProjectGraph>;
