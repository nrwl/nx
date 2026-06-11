"use strict";
var _ProjectGraphError_partialProjectGraph, _ProjectGraphError_partialSourceMaps;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadPluginError = exports.DaemonProjectGraphError = exports.AggregateProjectGraphError = exports.WorkspaceValidityError = exports.ProcessDependenciesError = exports.CreateMetadataError = exports.MergeNodesError = exports.AggregateCreateNodesError = exports.ProjectConfigurationsError = exports.ProjectWithNoNameError = exports.ProjectsWithNoNameError = exports.ProjectWithExistingNameError = exports.MultipleProjectsWithSameNameError = exports.ProjectGraphError = exports.StaleProjectGraphCacheError = void 0;
exports.isProjectWithExistingNameError = isProjectWithExistingNameError;
exports.isMultipleProjectsWithSameNameError = isMultipleProjectsWithSameNameError;
exports.isProjectsWithNoNameError = isProjectsWithNoNameError;
exports.isProjectWithNoNameError = isProjectWithNoNameError;
exports.isProjectConfigurationsError = isProjectConfigurationsError;
exports.formatAggregateCreateNodesError = formatAggregateCreateNodesError;
exports.isWorkspaceValidityError = isWorkspaceValidityError;
exports.isAggregateProjectGraphError = isAggregateProjectGraphError;
exports.isCreateMetadataError = isCreateMetadataError;
exports.isAggregateCreateNodesError = isAggregateCreateNodesError;
exports.isMergeNodesError = isMergeNodesError;
const tslib_1 = require("tslib");
class StaleProjectGraphCacheError extends Error {
    constructor() {
        super('The project graph cache was stale. Ensure that it has been recently created before using `readCachedProjectGraph`.');
    }
}
exports.StaleProjectGraphCacheError = StaleProjectGraphCacheError;
class ProjectGraphError extends Error {
    constructor(errors, partialProjectGraph, partialSourceMaps) {
        const messageFragments = ['Failed to process project graph.'];
        const mergeNodesErrors = [];
        const unknownErrors = [];
        // Lets us throw aggregate errors without special handling,
        // to avoid cases where users fix an error and get hit with another one
        // which was already there but not reported.
        let flat = errors.flatMap((e) => e instanceof AggregateError ? e.errors : e);
        for (const e of flat) {
            if (
            // Known errors that are self-explanatory
            isAggregateCreateNodesError(e) ||
                isCreateMetadataError(e) ||
                isProcessDependenciesError(e) ||
                isProjectsWithNoNameError(e) ||
                isMultipleProjectsWithSameNameError(e) ||
                isWorkspaceValidityError(e)) {
            }
            else if (
            // Known error type, but unlikely to be caused by the user
            isMergeNodesError(e)) {
                mergeNodesErrors.push(e);
            }
            else {
                unknownErrors.push(e);
            }
        }
        if (mergeNodesErrors.length > 0) {
            messageFragments.push(`This type of error most likely points to an issue within Nx. Please report it.`);
        }
        if (unknownErrors.length > 0) {
            messageFragments.push(`If the error cause is not obvious from the below error messages, running "nx reset" may fix it. Please report the issue if you keep seeing it.`);
        }
        super(messageFragments.join(' '));
        this.errors = errors;
        _ProjectGraphError_partialProjectGraph.set(this, void 0);
        _ProjectGraphError_partialSourceMaps.set(this, void 0);
        this.name = this.constructor.name;
        this.errors = errors;
        tslib_1.__classPrivateFieldSet(this, _ProjectGraphError_partialProjectGraph, partialProjectGraph, "f");
        tslib_1.__classPrivateFieldSet(this, _ProjectGraphError_partialSourceMaps, partialSourceMaps, "f");
        this.stack = errors
            .map((error) => indentString(formatErrorStackAndCause(error), 2))
            .join('\n');
    }
    /**
     * The daemon cannot throw errors which contain methods as they are not serializable.
     *
     * This method creates a new {@link ProjectGraphError} from a {@link DaemonProjectGraphError} with the methods based on the same serialized data.
     */
    static fromDaemonProjectGraphError(e) {
        return new ProjectGraphError(e.errors, e.projectGraph, e.sourceMaps);
    }
    /**
     * This gets the partial project graph despite the errors which occured.
     * This partial project graph may be missing nodes, properties of nodes, or dependencies.
     * This is useful mostly for visualization/debugging. It should not be used for running tasks.
     */
    getPartialProjectGraph() {
        return tslib_1.__classPrivateFieldGet(this, _ProjectGraphError_partialProjectGraph, "f");
    }
    getPartialSourcemaps() {
        return tslib_1.__classPrivateFieldGet(this, _ProjectGraphError_partialSourceMaps, "f");
    }
    getErrors() {
        return this.errors;
    }
}
exports.ProjectGraphError = ProjectGraphError;
_ProjectGraphError_partialProjectGraph = new WeakMap(), _ProjectGraphError_partialSourceMaps = new WeakMap();
class MultipleProjectsWithSameNameError extends Error {
    constructor(conflicts, projects) {
        super([
            `The following projects are defined in multiple locations:`,
            ...Array.from(conflicts.entries()).map(([project, roots]) => [`- ${project}: `, ...roots.map((r) => `  - ${r}`)].join('\n')),
            '',
            "To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name.",
        ].join('\n'));
        this.conflicts = conflicts;
        this.projects = projects;
        this.name = this.constructor.name;
    }
}
exports.MultipleProjectsWithSameNameError = MultipleProjectsWithSameNameError;
class ProjectWithExistingNameError extends Error {
    constructor(projectName, projectRoot) {
        super(`The project "${projectName}" is defined in multiple locations.`);
        this.projectName = projectName;
        this.projectRoot = projectRoot;
        this.name = this.constructor.name;
    }
}
exports.ProjectWithExistingNameError = ProjectWithExistingNameError;
function isProjectWithExistingNameError(e) {
    return (e instanceof ProjectWithExistingNameError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === ProjectWithExistingNameError.name));
}
function isMultipleProjectsWithSameNameError(e) {
    return (e instanceof MultipleProjectsWithSameNameError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === MultipleProjectsWithSameNameError.name));
}
class ProjectsWithNoNameError extends Error {
    constructor(projectRoots, projects) {
        super(`The projects in the following directories have no name provided:\n  - ${projectRoots.join('\n  - ')}`);
        this.projectRoots = projectRoots;
        this.projects = projects;
        this.name = this.constructor.name;
    }
}
exports.ProjectsWithNoNameError = ProjectsWithNoNameError;
function isProjectsWithNoNameError(e) {
    return (e instanceof ProjectsWithNoNameError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === ProjectsWithNoNameError.name));
}
class ProjectWithNoNameError extends Error {
    constructor(projectRoot) {
        super(`The project in ${projectRoot} has no name provided.`);
        this.projectRoot = projectRoot;
        this.name = this.constructor.name;
    }
}
exports.ProjectWithNoNameError = ProjectWithNoNameError;
function isProjectWithNoNameError(e) {
    return (e instanceof ProjectWithNoNameError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === ProjectWithNoNameError.name));
}
class ProjectConfigurationsError extends Error {
    constructor(errors, partialProjectConfigurationsResult) {
        const messageFragments = ['Failed to create project configurations.'];
        const mergeNodesErrors = [];
        const unknownErrors = [];
        for (const e of errors) {
            if (
            // Known error type, but unlikely to be caused by the user
            isMergeNodesError(e)) {
                mergeNodesErrors.push(e);
            }
            else if (
            // Known errors that are self-explanatory
            !isAggregateCreateNodesError(e) &&
                !isProjectsWithNoNameError(e) &&
                !isMultipleProjectsWithSameNameError(e)) {
                unknownErrors.push(e);
            }
        }
        if (mergeNodesErrors.length > 0) {
            messageFragments.push(`This type of error most likely points to an issue within Nx. Please report it.`);
        }
        if (unknownErrors.length > 0) {
            messageFragments.push(`If the error cause is not obvious from the below error messages, running "nx reset" may fix it. Please report the issue if you keep seeing it.`);
        }
        super(messageFragments.join(' '));
        this.errors = errors;
        this.partialProjectConfigurationsResult = partialProjectConfigurationsResult;
        this.name = this.constructor.name;
        this.errors = errors;
        this.stack = errors
            .map((error) => indentString(formatErrorStackAndCause(error), 2))
            .join('\n');
    }
}
exports.ProjectConfigurationsError = ProjectConfigurationsError;
function isProjectConfigurationsError(e) {
    return (e instanceof ProjectConfigurationsError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === ProjectConfigurationsError.name));
}
/**
 * This error should be thrown when a `createNodesV2` function hits a recoverable error.
 * It allows Nx to recieve partial results and continue processing for better UX.
 */
class AggregateCreateNodesError extends Error {
    /**
     * Throwing this error from a `createNodesV2` function will allow Nx to continue processing and recieve partial results from your plugin.
     * @example
     * export async function createNodesV2(
     *  files: string[],
     * ) {
     *   const partialResults = [];
     *   const errors = [];
     *   await Promise.all(files.map(async (file) => {
     *     try {
     *        const result = await createNodes(file);
     *        partialResults.push(result);
     *     } catch (e) {
     *        errors.push([file, e]);
     *     }
     *   }));
     *  if (errors.length > 0) {
     *     throw new AggregateCreateNodesError(errors, partialResults);
     *   }
     *   return partialResults;
     * }
     *
     * @param errors An array of tuples that represent errors encountered when processing a given file. An example entry might look like ['path/to/project.json', [Error: 'Invalid JSON. Unexpected token 'a' in JSON at position 0]]
     * @param partialResults The partial results of the `createNodesV2` function. This should be the results for each file that didn't encounter an issue.
     */
    constructor(errors, partialResults) {
        super('Failed to create nodes');
        this.errors = errors;
        this.partialResults = partialResults;
        this.name = this.constructor.name;
        if (
        // Errors should be an array
        !Array.isArray(errors) ||
            !errors.every(
            // Where every element is a tuple
            (errorTuple) => Array.isArray(errorTuple) &&
                // That has a length of 2
                errorTuple.length === 2)) {
            throw new Error('AggregateCreateNodesError must be constructed with an array of tuples where the first element is a filename or undefined and the second element is the underlying error.');
        }
    }
}
exports.AggregateCreateNodesError = AggregateCreateNodesError;
function formatAggregateCreateNodesError(error, pluginName) {
    const errorCount = error.errors.length > 1 ? `${error.errors.length} errors` : 'An error';
    const pluginLocation = error.pluginIndex
        ? ` (Defined at nx.json#plugins[${error.pluginIndex}])`
        : '';
    const errorBodyLines = [
        `${errorCount} occurred while processing files for the ${pluginName} plugin${pluginLocation}.`,
    ];
    const errorStackLines = [];
    // Group errors by file so repeated file paths aren't printed multiple times
    const groupedErrors = new Map();
    for (const [file, e] of error.errors) {
        const key = file ?? null;
        if (!groupedErrors.has(key)) {
            groupedErrors.set(key, []);
        }
        groupedErrors.get(key).push(e);
    }
    for (const [file, errors] of groupedErrors) {
        if (file) {
            errorBodyLines.push(`  - ${file}:`);
            errorStackLines.push(` - ${file}:`);
        }
        for (const e of errors) {
            const messageLines = e.message.split('\n');
            const stackLines = e.stack.split('\n');
            if (file) {
                errorBodyLines.push(...messageLines.map((line) => `      ${line}`));
                errorStackLines.push(...stackLines.map((line) => `     ${line}`));
            }
            else {
                errorBodyLines.push(`  - ${messageLines[0]}`, ...messageLines.slice(1).map((line) => `    ${line}`));
                errorStackLines.push(` - ${stackLines[0]}`, ...stackLines.slice(1).map((line) => `   ${line}`));
            }
            if (e.stack && process.env.NX_VERBOSE_LOGGING === 'true') {
                const verboseIndent = file ? '       ' : '     ';
                const innerStackTrace = e.stack
                    .split('\n')
                    .map((line) => `${verboseIndent}${line}`)
                    .join('\n');
                errorStackLines.push(innerStackTrace);
            }
        }
    }
    error.stack = errorStackLines.join('\n');
    error.message = errorBodyLines.join('\n');
}
class MergeNodesError extends Error {
    constructor({ file, pluginName, error, pluginIndex, }) {
        const msg = `The nodes created from ${file} by the "${pluginName}" ${pluginIndex === undefined
            ? ''
            : `at index ${pluginIndex} in nx.json#plugins `}could not be merged into the project graph.`;
        super(msg, { cause: error });
        this.name = this.constructor.name;
        this.file = file;
        this.pluginName = pluginName;
        this.pluginIndex = pluginIndex;
        this.stack = `${this.message}\n${indentString(formatErrorStackAndCause(error), 2)}`;
    }
}
exports.MergeNodesError = MergeNodesError;
class CreateMetadataError extends Error {
    constructor(error, plugin) {
        super(`The "${plugin}" plugin threw an error while creating metadata: ${error.message}`, {
            cause: error,
        });
        this.error = error;
        this.plugin = plugin;
        this.name = this.constructor.name;
    }
}
exports.CreateMetadataError = CreateMetadataError;
class ProcessDependenciesError extends Error {
    constructor(pluginName, { cause }) {
        super(`The "${pluginName}" plugin threw an error while creating dependencies: ${cause.message}`, {
            cause,
        });
        this.pluginName = pluginName;
        this.name = this.constructor.name;
        this.stack = `${this.message}\n  ${cause.stack.split('\n').join('\n  ')}`;
    }
}
exports.ProcessDependenciesError = ProcessDependenciesError;
function isProcessDependenciesError(e) {
    return (e instanceof ProcessDependenciesError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === ProcessDependenciesError.name));
}
class WorkspaceValidityError extends Error {
    constructor(message) {
        super(message);
        this.message = message;
        this.message = `[Configuration Error]:\n${message}`;
        this.name = this.constructor.name;
    }
    toString() {
        return this.message;
    }
}
exports.WorkspaceValidityError = WorkspaceValidityError;
function isWorkspaceValidityError(e) {
    return (e instanceof WorkspaceValidityError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === WorkspaceValidityError.name));
}
class AggregateProjectGraphError extends Error {
    constructor(errors, partialProjectGraph) {
        super('Failed to create project graph. See above for errors');
        this.errors = errors;
        this.partialProjectGraph = partialProjectGraph;
        this.name = this.constructor.name;
    }
}
exports.AggregateProjectGraphError = AggregateProjectGraphError;
function isAggregateProjectGraphError(e) {
    return (e instanceof AggregateProjectGraphError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === AggregateProjectGraphError.name));
}
function isCreateMetadataError(e) {
    return (e instanceof CreateMetadataError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === CreateMetadataError.name));
}
function isAggregateCreateNodesError(e) {
    return (e instanceof AggregateCreateNodesError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === AggregateCreateNodesError.name));
}
function isMergeNodesError(e) {
    return (e instanceof MergeNodesError ||
        (typeof e === 'object' && 'name' in e && e?.name === MergeNodesError.name));
}
class DaemonProjectGraphError extends Error {
    constructor(errors, projectGraph, sourceMaps) {
        super(`The Daemon Process threw an error while calculating the project graph. Convert this error to a ProjectGraphError to get more information.`);
        this.errors = errors;
        this.projectGraph = projectGraph;
        this.sourceMaps = sourceMaps;
        this.name = this.constructor.name;
    }
}
exports.DaemonProjectGraphError = DaemonProjectGraphError;
class LoadPluginError extends Error {
    constructor(plugin, cause) {
        super(`Could not load plugin ${plugin}`, {
            cause,
        });
        this.plugin = plugin;
        this.name = this.constructor.name;
    }
}
exports.LoadPluginError = LoadPluginError;
function indentString(str, indent) {
    return (' '.repeat(indent) +
        str
            .split('\n')
            .map((line) => ' '.repeat(indent) + line)
            .join('\n'));
}
function formatErrorStackAndCause(error) {
    const cause = error.cause && error.cause instanceof Error ? error.cause : null;
    return (error.stack +
        (cause
            ? `\nCaused by: \n${indentString(cause.stack ?? cause.message, 2)}`
            : ''));
}
