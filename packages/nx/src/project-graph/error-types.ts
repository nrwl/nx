import { CreateNodesResultWithContext } from './plugins/internal-api';
import {
  ConfigurationResult,
  ConfigurationSourceMaps,
} from './utils/project-configuration-utils';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { ProjectGraph } from '../config/project-graph';

export class ProjectGraphError extends Error {
  readonly #errors: Array<
    | CreateNodesError
    | MergeNodesError
    | CreateMetadataError
    | ProjectsWithNoNameError
    | MultipleProjectsWithSameNameError
    | ProcessDependenciesError
    | ProcessProjectGraphError
    | WorkspaceValidityError
  >;
  readonly #partialProjectGraph: ProjectGraph;
  readonly #partialSourceMaps: ConfigurationSourceMaps;

  constructor(
    errors: Array<
      | CreateNodesError
      | MergeNodesError
      | ProjectsWithNoNameError
      | MultipleProjectsWithSameNameError
      | ProcessDependenciesError
      | ProcessProjectGraphError
      | CreateMetadataError
      | WorkspaceValidityError
    >,
    partialProjectGraph: ProjectGraph,
    partialSourceMaps: ConfigurationSourceMaps
  ) {
    super(
      `Failed to process project graph. Run "nx reset" to fix this. Please report the issue if you keep seeing it.`
    );
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

export class MultipleProjectsWithSameNameError extends Error {
  constructor(
    public conflicts: Map<string, string[]>,
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

export class ProjectWithExistingNameError extends Error {
  constructor(public projectName: string, public projectRoot: string) {
    super(`The project "${projectName}" is defined in multiple locations.`);
    this.name = this.constructor.name;
  }
}

export function isProjectWithExistingNameError(
  e: unknown
): e is ProjectWithExistingNameError {
  return (
    e instanceof ProjectWithExistingNameError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === ProjectWithExistingNameError.name)
  );
}

export function isMultipleProjectsWithSameNameError(
  e: unknown
): e is MultipleProjectsWithSameNameError {
  return (
    e instanceof MultipleProjectsWithSameNameError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === MultipleProjectsWithSameNameError.name)
  );
}

export class ProjectsWithNoNameError extends Error {
  constructor(
    public projectRoots: string[],
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
      e?.name === ProjectsWithNoNameError.name)
  );
}

export class ProjectWithNoNameError extends Error {
  constructor(public projectRoot: string) {
    super(`The project in ${projectRoot} has no name provided.`);
    this.name = this.constructor.name;
  }
}

export function isProjectWithNoNameError(
  e: unknown
): e is ProjectWithNoNameError {
  return (
    e instanceof ProjectWithNoNameError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === ProjectWithNoNameError.name)
  );
}

export class ProjectConfigurationsError extends Error {
  constructor(
    public readonly errors: Array<
      | MergeNodesError
      | CreateNodesError
      | ProjectsWithNoNameError
      | MultipleProjectsWithSameNameError
    >,
    public readonly partialProjectConfigurationsResult: ConfigurationResult
  ) {
    super('Failed to create project configurations');
    this.name = this.constructor.name;
  }
}

export function isProjectConfigurationsError(
  e: unknown
): e is ProjectConfigurationsError {
  return (
    e instanceof ProjectConfigurationsError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === ProjectConfigurationsError.name)
  );
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

export class CreateMetadataError extends Error {
  constructor(public readonly error: Error, public readonly plugin: string) {
    super(`The "${plugin}" plugin threw an error while creating metadata:`, {
      cause: error,
    });
    this.name = this.constructor.name;
  }
}

export class ProcessDependenciesError extends Error {
  constructor(public readonly pluginName: string, { cause }) {
    super(
      `The "${pluginName}" plugin threw an error while creating dependencies:`,
      {
        cause,
      }
    );
    this.name = this.constructor.name;
    this.stack = `${this.message}\n  ${cause.stack.split('\n').join('\n  ')}`;
  }
}
export class WorkspaceValidityError extends Error {
  constructor(public message: string) {
    message = `Configuration Error\n${message}`;
    super(message);
    this.name = this.constructor.name;
  }
}

export function isWorkspaceValidityError(
  e: unknown
): e is WorkspaceValidityError {
  return (
    e instanceof WorkspaceValidityError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === WorkspaceValidityError.name)
  );
}

export class ProcessProjectGraphError extends Error {
  constructor(public readonly pluginName: string, { cause }) {
    super(
      `The "${pluginName}" plugin threw an error while processing the project graph:`,
      {
        cause,
      }
    );
    this.name = this.constructor.name;
    this.stack = `${this.message}\n  ${cause.stack.split('\n').join('\n  ')}`;
  }
}

export class AggregateProjectGraphError extends Error {
  constructor(
    public readonly errors: Array<
      | CreateMetadataError
      | ProcessDependenciesError
      | ProcessProjectGraphError
      | WorkspaceValidityError
    >,
    public readonly partialProjectGraph: ProjectGraph
  ) {
    super('Failed to create project graph. See above for errors');
    this.name = this.constructor.name;
  }
}

export function isAggregateProjectGraphError(
  e: unknown
): e is AggregateProjectGraphError {
  return (
    e instanceof AggregateProjectGraphError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === AggregateProjectGraphError.name)
  );
}

export function isCreateMetadataError(e: unknown): e is CreateMetadataError {
  return (
    e instanceof CreateMetadataError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === CreateMetadataError.name)
  );
}

export function isCreateNodesError(e: unknown): e is CreateNodesError {
  return (
    e instanceof CreateNodesError ||
    (typeof e === 'object' && 'name' in e && e?.name === CreateNodesError.name)
  );
}

export function isAggregateCreateNodesError(
  e: unknown
): e is AggregateCreateNodesError {
  return (
    e instanceof AggregateCreateNodesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === AggregateCreateNodesError.name)
  );
}

export function isMergeNodesError(e: unknown): e is MergeNodesError {
  return (
    e instanceof MergeNodesError ||
    (typeof e === 'object' && 'name' in e && e?.name === MergeNodesError.name)
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

export class LoadPluginError extends Error {
  constructor(public plugin: string, cause: Error) {
    super(`Could not load plugin ${plugin}`, {
      cause,
    });
    this.name = this.constructor.name;
  }
}
