"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InProcessTaskHasher = exports.DaemonBasedTaskHasher = void 0;
exports.getNamedInputs = getNamedInputs;
exports.getTargetInputs = getTargetInputs;
exports.extractPatternsFromFileSets = extractPatternsFromFileSets;
exports.getInputs = getInputs;
exports.splitInputsIntoSelfAndDependencies = splitInputsIntoSelfAndDependencies;
exports.isSelfInput = isSelfInput;
exports.isDepsOutput = isDepsOutput;
exports.expandSingleProjectInputs = expandSingleProjectInputs;
exports.expandNamedInput = expandNamedInput;
exports.filterUsingGlobPatterns = filterUsingGlobPatterns;
const file_hasher_1 = require("./file-hasher");
const minimatch_1 = require("minimatch");
const native_task_hasher_impl_1 = require("./native-task-hasher-impl");
const workspace_root_1 = require("../utils/workspace-root");
const task_io_service_1 = require("../tasks-runner/task-io-service");
/**
 * Normalize the legacy single-env `hashTasks(tasks, taskGraph, env)`
 * signature to the per-task-env shape. External plugins still call the
 * legacy shape, so `InProcessTaskHasher` and `DaemonBasedTaskHasher`
 * detect at runtime and broadcast the shared env across every task.
 *
 * Detection is by value shape: `NodeJS.ProcessEnv` values are strings
 * (or undefined), `perTaskEnvs` values are objects.
 */
function normalizePerTaskEnvs(tasks, arg) {
    for (const value of Object.values(arg)) {
        if (value === undefined)
            continue;
        if (typeof value === 'object') {
            return arg;
        }
        // First defined value is a string — legacy env; broadcast it.
        const env = arg;
        const perTaskEnvs = {};
        for (const task of tasks)
            perTaskEnvs[task.id] = env;
        return perTaskEnvs;
    }
    // Empty or all-undefined: treat as perTaskEnvs — safe because the
    // Rust-side check will surface a clear error if entries are missing.
    return arg;
}
class DaemonBasedTaskHasher {
    constructor(daemonClient, runnerOptions) {
        this.daemonClient = daemonClient;
        this.runnerOptions = runnerOptions;
    }
    async hashTasks(tasks, taskGraph, envOrPerTaskEnvs) {
        const collectInputs = (0, task_io_service_1.getTaskIOService)().hasTaskInputSubscribers();
        return this.daemonClient.hashTasks(this.runnerOptions, tasks, taskGraph, normalizePerTaskEnvs(tasks, envOrPerTaskEnvs), process.cwd(), collectInputs);
    }
    async hashTask(task, taskGraph, env) {
        return (await this.hashTasks([task], taskGraph, {
            [task.id]: env ?? process.env,
        }))[0];
    }
}
exports.DaemonBasedTaskHasher = DaemonBasedTaskHasher;
class InProcessTaskHasher {
    constructor(projectGraph, nxJson, externalRustReferences, options) {
        this.projectGraph = projectGraph;
        this.nxJson = nxJson;
        this.externalRustReferences = externalRustReferences;
        this.options = options;
        this.taskHasher = new native_task_hasher_impl_1.NativeTaskHasherImpl(workspace_root_1.workspaceRoot, this.nxJson, this.projectGraph, this.externalRustReferences, {
            selectivelyHashTsConfig: this.options?.selectivelyHashTsConfig ?? false,
        });
    }
    async hashTasks(tasks, taskGraph, envOrPerTaskEnvs, cwd, collectInputs) {
        const hashes = await this.taskHasher.hashTasks(tasks, taskGraph, normalizePerTaskEnvs(tasks, envOrPerTaskEnvs), cwd ?? process.cwd(), collectInputs);
        return tasks.map((task, index) => this.createHashDetails(task, hashes[index]));
    }
    async hashTask(task, taskGraph, env, cwd, collectInputs) {
        const res = await this.taskHasher.hashTask(task, taskGraph, env ?? process.env, cwd ?? process.cwd(), collectInputs);
        return this.createHashDetails(task, res);
    }
    createHashDetails(task, res) {
        const command = this.hashCommand(task);
        return {
            value: (0, file_hasher_1.hashArray)([res.value, command]),
            details: {
                command,
                nodes: res.details,
                implicitDeps: {},
                runtime: {},
            },
            inputs: res.inputs,
        };
    }
    hashCommand(task) {
        const overrides = { ...task.overrides };
        delete overrides['__overrides_unparsed__'];
        const sortedOverrides = {};
        for (let k of Object.keys(overrides).sort()) {
            sortedOverrides[k] = overrides[k];
        }
        return (0, file_hasher_1.hashArray)([
            task.target.project ?? '',
            task.target.target ?? '',
            task.target.configuration ?? '',
            JSON.stringify(sortedOverrides),
        ]);
    }
}
exports.InProcessTaskHasher = InProcessTaskHasher;
const DEFAULT_INPUTS = [
    {
        input: 'default',
    },
    {
        dependencies: true,
        input: 'default',
    },
];
function getNamedInputs(nxJson, project) {
    return {
        default: [{ fileset: '{projectRoot}/**/*' }],
        ...nxJson.namedInputs,
        ...project.data.namedInputs,
    };
}
function getTargetInputs(nxJson, projectNode, target) {
    const namedInputs = getNamedInputs(nxJson, projectNode);
    const targetData = projectNode.data.targets[target];
    const targetDefaults = (nxJson.targetDefaults || {})[target];
    const inputs = splitInputsIntoSelfAndDependencies(targetData.inputs || targetDefaults?.inputs || DEFAULT_INPUTS, namedInputs);
    const selfInputs = extractPatternsFromFileSets(inputs.selfInputs);
    const dependencyInputs = [
        ...extractPatternsFromFileSets(inputs.depsInputs
            .map((s) => expandNamedInput(s.input, namedInputs))
            .flat()),
        ...inputs.depsFilesets.map((d) => d.fileset),
    ];
    return { selfInputs, dependencyInputs };
}
function extractPatternsFromFileSets(inputs) {
    return inputs
        .filter((c) => !!c['fileset'])
        .map((c) => c['fileset']);
}
function getInputs(task, projectGraph, nxJson) {
    const projectNode = projectGraph.nodes[task.target.project];
    const namedInputs = getNamedInputs(nxJson, projectNode);
    const targetData = projectNode.data.targets[task.target.target];
    const targetDefaults = (nxJson.targetDefaults || {})[task.target.target];
    const { selfInputs, depsInputs, depsOutputs, projectInputs, depsFilesets } = splitInputsIntoSelfAndDependencies(targetData.inputs || targetDefaults?.inputs || DEFAULT_INPUTS, namedInputs);
    return { selfInputs, depsInputs, depsOutputs, projectInputs, depsFilesets };
}
function splitInputsIntoSelfAndDependencies(inputs, namedInputs) {
    const depsInputs = [];
    const projectInputs = [];
    const depsFilesets = [];
    const selfInputs = [];
    for (const d of inputs) {
        if (typeof d === 'string') {
            if (d.startsWith('^')) {
                const rest = d.substring(1);
                if (rest.startsWith('{projectRoot}') ||
                    rest.startsWith('{workspaceRoot}')) {
                    depsFilesets.push({ fileset: rest, dependencies: true });
                }
                else {
                    depsInputs.push({ input: rest, dependencies: true });
                }
            }
            else {
                selfInputs.push(d);
            }
        }
        else {
            if ('fileset' in d && 'dependencies' in d && d.dependencies) {
                depsFilesets.push({
                    fileset: d.fileset,
                    dependencies: true,
                });
            }
            else if ('input' in d &&
                !('fileset' in d) &&
                (('dependencies' in d && d.dependencies) ||
                    // Todo(@AgentEnder): Remove check in v17
                    ('projects' in d &&
                        typeof d.projects === 'string' &&
                        d.projects === 'dependencies'))) {
                depsInputs.push({
                    input: d.input,
                    dependencies: true,
                });
            }
            else if ('input' in d &&
                !('fileset' in d) &&
                'projects' in d &&
                d.projects &&
                // Todo(@AgentEnder): Remove check in v17
                !(d.projects === 'self')) {
                projectInputs.push({
                    input: d.input,
                    projects: Array.isArray(d.projects) ? d.projects : [d.projects],
                });
            }
            else {
                selfInputs.push(d);
            }
        }
    }
    const expandedInputs = expandSingleProjectInputs(selfInputs, namedInputs);
    return {
        depsInputs,
        projectInputs,
        selfInputs: expandedInputs.filter(isSelfInput),
        depsOutputs: expandedInputs.filter(isDepsOutput),
        depsFilesets,
    };
}
function isSelfInput(input) {
    return !('dependentTasksOutputFiles' in input);
}
function isDepsOutput(input) {
    return 'dependentTasksOutputFiles' in input;
}
function expandSingleProjectInputs(inputs, namedInputs) {
    const expanded = [];
    for (const d of inputs) {
        if (typeof d === 'string') {
            if (d.startsWith('^'))
                throw new Error(`namedInputs definitions cannot start with ^`);
            if (namedInputs[d]) {
                expanded.push(...expandNamedInput(d, namedInputs));
            }
            else {
                expanded.push({ fileset: d });
            }
        }
        else {
            if (d.projects || d.dependencies) {
                throw new Error(`namedInputs definitions can only refer to other namedInputs definitions within the same project.`);
            }
            if (d.fileset ||
                d.env ||
                d.runtime ||
                d.externalDependencies ||
                d.dependentTasksOutputFiles ||
                d.workingDirectory ||
                d.json) {
                expanded.push(d);
            }
            else {
                expanded.push(...expandNamedInput(d.input, namedInputs));
            }
        }
    }
    return expanded;
}
function expandNamedInput(input, namedInputs) {
    namedInputs ||= {};
    if (!namedInputs[input])
        throw new Error(`Input '${input}' is not defined`);
    return expandSingleProjectInputs(namedInputs[input], namedInputs);
}
function filterUsingGlobPatterns(root, files, patterns) {
    const filesetWithExpandedProjectRoot = patterns
        .map((f) => f.replace('{projectRoot}', root))
        .map((r) => {
        // handling root level projects that create './' pattern that doesn't work with minimatch
        if (r.startsWith('./'))
            return r.substring(2);
        if (r.startsWith('!./'))
            return '!' + r.substring(3);
        return r;
    });
    const positive = [];
    const negative = [];
    for (const p of filesetWithExpandedProjectRoot) {
        if (p.startsWith('!')) {
            negative.push(p);
        }
        else {
            positive.push(p);
        }
    }
    if (positive.length === 0 && negative.length === 0) {
        return files;
    }
    return files.filter((f) => {
        let matchedPositive = false;
        if (positive.length === 0 ||
            (positive.length === 1 && positive[0] === `${root}/**/*`)) {
            matchedPositive = true;
        }
        else {
            matchedPositive = positive.some((pattern) => (0, minimatch_1.minimatch)(f.file, pattern));
        }
        if (!matchedPositive)
            return false;
        return negative.every((pattern) => (0, minimatch_1.minimatch)(f.file, pattern));
    });
}
