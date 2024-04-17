import { CreateNodesResultWithContext } from './plugins/internal-api';
import {
  ConfigurationResult,
  ConfigurationSourceMaps,
} from './utils/project-configuration-utils';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import {
  ProcessDependenciesError,
  ProcessProjectGraphError,
} from './build-project-graph';
import { ProjectGraph } from '../config/project-graph';

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

export class ProjectsWithConflictingNamesError extends Error {
  constructor(
    conflicts: Map<string, string[]>,
    public projects: Record<string, ProjectConfiguration>
  ) {
    super(
      [
        `The following projects are defined in multiple locations:`,
        ...Array.from(conflicts.entries()).map(([project, roots]) =>
          [`- ${project}: `, ...roots.map((r) => `  - ${r}`)].join('\n')
        ),
        '',
        "To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name.",
      ].join('\n')
    );
    this.name = this.constructor.name;
  }
}

export function isProjectsWithConflictingNamesError(
  e: unknown
): e is ProjectsWithConflictingNamesError {
  return (
    e instanceof ProjectsWithConflictingNamesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === ProjectsWithConflictingNamesError.prototype.name)
  );
}

export class ProjectsWithNoNameError extends Error {
  constructor(
    projectRoots: string[],
    public projects: Record<string, ProjectConfiguration>
  ) {
    super(
      `The projects in the following directories have no name provided:\n  - ${projectRoots.join(
        '\n  - '
      )}`
    );
    this.name = this.constructor.name;
  }
}

export function isProjectsWithNoNameError(
  e: unknown
): e is ProjectsWithNoNameError {
  return (
    e instanceof ProjectsWithNoNameError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === ProjectsWithNoNameError.prototype.name)
  );
}

export class ProjectConfigurationsError extends Error {
  constructor(
    public readonly errors: Array<
      | MergeNodesError
      | CreateNodesError
      | ProjectsWithNoNameError
      | ProjectsWithConflictingNamesError
    >,
    public readonly partialProjectConfigurationsResult: ConfigurationResult
  ) {
    super('Failed to create project configurations');
    this.name = this.constructor.name;
  }
}

export class CreateNodesError extends Error {
  file: string;
  pluginName: string;

  constructor({
    file,
    pluginName,
    error,
  }: {
    file: string;
    pluginName: string;
    error: Error;
  }) {
    const msg = `The "${pluginName}" plugin threw an error while creating nodes from ${file}:`;

    super(msg, { cause: error });
    this.name = this.constructor.name;
    this.file = file;
    this.pluginName = pluginName;
    this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
  }
}

export class AggregateCreateNodesError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly errors: Array<CreateNodesError>,
    public readonly partialResults: Array<CreateNodesResultWithContext>
  ) {
    super('Failed to create nodes');
    this.name = this.constructor.name;
  }
}

export class MergeNodesError extends Error {
  file: string;
  pluginName: string;

  constructor({
    file,
    pluginName,
    error,
  }: {
    file: string;
    pluginName: string;
    error: Error;
  }) {
    const msg = `The nodes created from ${file} by the "${pluginName}" could not be merged into the project graph:`;

    super(msg, { cause: error });
    this.name = this.constructor.name;
    this.file = file;
    this.pluginName = pluginName;
    this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
  }
}

export function isCreateNodesError(e: unknown): e is CreateNodesError {
  return (
    e instanceof CreateNodesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === CreateNodesError.prototype.name)
  );
}

export function isAggregateCreateNodesError(
  e: unknown
): e is AggregateCreateNodesError {
  return (
    e instanceof AggregateCreateNodesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === AggregateCreateNodesError.prototype.name)
  );
}

export function isMergeNodesError(e: unknown): e is MergeNodesError {
  return (
    e instanceof MergeNodesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === MergeNodesError.prototype.name)
  );
}

export class DaemonProjectGraphError extends Error {
  constructor(
    public errors: any[],
    readonly projectGraph: ProjectGraph,
    readonly sourceMaps: ConfigurationSourceMaps
  ) {
    super(
      `The Daemon Process threw an error while calculating the project graph. Convert this error to a ProjectGraphError to get more information.`
    );
    this.name = this.constructor.name;
  }
}
