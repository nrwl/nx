import { DaemonProjectGraphError } from '../daemon/daemon-project-graph-error';
import { ProjectGraph } from '../devkit-exports';
import {
  ProcessDependenciesError,
  ProcessProjectGraphError,
} from './build-project-graph';
import {
  CreateNodesError,
  MergeNodesError,
  ProjectsWithConflictingNamesError,
  ProjectsWithNoNameError,
} from './error-types';
import { ConfigurationSourceMaps } from './utils/project-configuration-utils';

export class ProjectGraphError extends Error {
  readonly #errors: Array<
    | CreateNodesError
    | MergeNodesError
    | ProjectsWithNoNameError
    | ProjectsWithConflictingNamesError
    | ProcessDependenciesError
    | ProcessProjectGraphError
  >;
  readonly #partialProjectGraph: ProjectGraph;
  readonly #partialSourceMaps: ConfigurationSourceMaps;

  constructor(
    errors: Array<
      | CreateNodesError
      | MergeNodesError
      | ProjectsWithNoNameError
      | ProjectsWithConflictingNamesError
      | ProcessDependenciesError
      | ProcessProjectGraphError
    >,
    partialProjectGraph: ProjectGraph,
    partialSourceMaps: ConfigurationSourceMaps
  ) {
    super(`Failed to process project graph.`);
    this.name = this.constructor.name;
    this.#errors = errors;
    this.#partialProjectGraph = partialProjectGraph;
    this.#partialSourceMaps = partialSourceMaps;
    this.stack = `${this.message}\n  ${errors
      .map((error) => error.stack.split('\n').join('\n  '))
      .join('\n')}`;
  }

  /**
   * The daemon cannot throw errors which contain methods as they are not serializable.
   *
   * This method creates a new {@link ProjectGraphError} from a {@link DaemonProjectGraphError} with the methods based on the same serialized data.
   */
  static fromDaemonProjectGraphError(e: DaemonProjectGraphError) {
    return new ProjectGraphError(e.errors, e.projectGraph, e.sourceMaps);
  }

  /**
   * This gets the partial project graph despite the errors which occured.
   * This partial project graph may be missing nodes, properties of nodes, or dependencies.
   * This is useful mostly for visualization/debugging. It should not be used for running tasks.
   */
  getPartialProjectGraph() {
    return this.#partialProjectGraph;
  }

  getPartialSourcemaps() {
    return this.#partialSourceMaps;
  }

  getErrors() {
    return this.#errors;
  }
}
