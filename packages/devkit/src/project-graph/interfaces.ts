import type {
  TargetConfiguration,
  Workspace,
} from '@nrwl/tao/src/shared/workspace';

/**
 * Some metadata about a file
 */
export interface FileData {
  file: string;
  hash: string;
  /** @deprecated this field will be removed in v13. Use {@link path.extname} to parse extension */
  ext?: string;
  deps?: string[];
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
export interface ProjectGraph<T = any> {
  nodes: Record<string, ProjectGraphNode<T>>;
  externalNodes?: Record<string, ProjectGraphExternalNode>;
  dependencies: Record<string, ProjectGraphDependency[]>;
  // this is optional otherwise it might break folks who use project graph creation
  allWorkspaceFiles?: FileData[];
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
 * A node describing a node in a workspace
 */
export type ProjectGraphNode<T = any> =
  | ProjectGraphProjectNode<T>
  | ProjectGraphExternalNode;

/**
 * A node describing a project in a workspace
 */
export interface ProjectGraphProjectNode<T = any> {
  type: 'app' | 'e2e' | 'lib';
  name: string;
  /**
   * Additional metadata about a project
   */
  data: T & {
    /**
     * The project's root directory
     */
    root: string;
    sourceRoot?: string;
    /**
     * Targets associated to the project
     */
    targets?: { [targetName: string]: TargetConfiguration };
    /**
     * Project's tags used for enforcing module boundaries
     */
    tags?: string[];
    /**
     * Projects on which this node implicitly depends on
     */
    implicitDependencies?: string[];
    /**
     * Files associated to the project
     */
    files: FileData[];
  };
}

/**
 * A node describing an external dependency
 */
export interface ProjectGraphExternalNode {
  type: 'npm';
  name: `npm:${string}`;
  data: {
    version: string;
    packageName: string;
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
   */
  workspace: Workspace;

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
) => ProjectGraph;

/**
 * A plugin for Nx
 */
export interface NxPlugin {
  processProjectGraph: ProjectGraphProcessor;
}
