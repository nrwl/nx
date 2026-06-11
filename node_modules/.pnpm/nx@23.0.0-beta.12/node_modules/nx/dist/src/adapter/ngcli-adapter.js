"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = exports.NxScopeHostUsedForWrappedSchematics = exports.NxScopedHostForBuilders = exports.NxScopedHost = void 0;
exports.createBuilderContext = createBuilderContext;
exports.scheduleTarget = scheduleTarget;
exports.arrayBufferToString = arrayBufferToString;
exports.generate = generate;
exports.runMigration = runMigration;
exports.mockSchematicsForTesting = mockSchematicsForTesting;
exports.wrapAngularDevkitSchematic = wrapAngularDevkitSchematic;
exports.restoreNxTokensInOptions = restoreNxTokensInOptions;
const tslib_1 = require("tslib");
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const pc = tslib_1.__importStar(require("picocolors"));
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const tree_1 = require("../generators/tree");
const json_1 = require("../generators/utils/json");
const project_configuration_1 = require("../generators/utils/project-configuration");
const project_graph_1 = require("../project-graph/project-graph");
const fileutils_1 = require("../utils/fileutils");
const installation_directory_1 = require("../utils/installation-directory");
const json_2 = require("../utils/json");
const logger_1 = require("../utils/logger");
const package_json_1 = require("../utils/package-json");
const package_manager_1 = require("../utils/package-manager");
const angular_json_1 = require("./angular-json");
const executor_utils_1 = require("../command-line/run/executor-utils");
const plugins_1 = require("../project-graph/plugins");
const schema_utils_1 = require("../config/schema-utils");
const handle_import_1 = require("../utils/handle-import");
const target_merging_1 = require("../project-graph/utils/project-configuration/target-merging");
function getProjectGraph() {
    try {
        return Promise.resolve((0, project_graph_1.readCachedProjectGraph)());
    }
    catch {
        return (0, project_graph_1.createProjectGraphAsync)();
    }
}
function getUndefinedDefaultsTransform(isAngularBuild) {
    // `addUndefinedObjectDefaults` was introduced in @angular-devkit/core v20.
    // `@nx/angular` supports Angular >=19, so fall back to `addUndefinedDefaults`
    // when the object-specific transform is unavailable.
    if (isAngularBuild && core_1.schema.transforms.addUndefinedObjectDefaults) {
        return core_1.schema.transforms.addUndefinedObjectDefaults;
    }
    return core_1.schema.transforms.addUndefinedDefaults;
}
async function createBuilderContext(builderInfo, context) {
    require('./compat');
    const fsHost = new NxScopedHostForBuilders(context.root, context.projectGraph);
    // the top level import is not patched because it is imported before the
    // patching happens so we require it here to use the patched version below
    const { workspaces } = require('@angular-devkit/core');
    const { workspace } = await workspaces.readWorkspace('angular.json', workspaces.createWorkspaceHost(fsHost));
    const architectHost = await getWrappedWorkspaceNodeModulesArchitectHost(workspace, context.root, context.projectsConfigurations.projects);
    const registry = new core_1.schema.CoreSchemaRegistry();
    const isAngularBuild = builderInfo.builderName.startsWith('@angular/build:') ||
        ['@nx/angular:application', '@nx/angular:unit-test'].includes(builderInfo.builderName);
    registry.addPostTransform(getUndefinedDefaultsTransform(isAngularBuild));
    registry.addSmartDefaultProvider('unparsed', () => {
        // This happens when context.scheduleTarget is used to run a target using nx:run-commands
        return [];
    });
    const { Architect } = require('@angular-devkit/architect');
    const architect = new Architect(architectHost, registry);
    const { firstValueFrom } = require('rxjs');
    const toPromise = (obs) => firstValueFrom ? firstValueFrom(obs) : obs.toPromise();
    const validateOptions = (options, builderName) => toPromise(architect['_scheduler'].schedule('..validateOptions', [
        builderName,
        options,
    ]).output);
    const getProjectMetadata = (target) => toPromise(architect['_scheduler'].schedule('..getProjectMetadata', target).output);
    const getBuilderNameForTarget = (target) => {
        if (typeof target === 'string') {
            return Promise.resolve(context.projectGraph.nodes[context.projectName].data.targets[target]
                .executor);
        }
        return Promise.resolve(context.projectGraph.nodes[target.project].data.targets[target.target]
            .executor);
    };
    const getTargetOptions = (target) => {
        if (typeof target === 'string') {
            return Promise.resolve({
                ...context.projectGraph.nodes[context.projectName].data.targets[target]
                    .options,
            });
        }
        return Promise.resolve({
            ...context.projectGraph.nodes[target.project].data.targets[target.target]
                .options,
            ...context.projectGraph.nodes[target.project].data.targets[target.target]
                .configurations[target.configuration],
        });
    };
    const builderContext = {
        workspaceRoot: context.root,
        target: {
            project: context.projectName,
            target: context.targetName,
            configuration: context.configurationName,
        },
        builder: {
            ...builderInfo,
        },
        logger: (0, exports.getLogger)(),
        id: 1,
        currentDirectory: process.cwd(),
        scheduleTarget: (...args) => architect.scheduleTarget(...args),
        scheduleBuilder: (...args) => architect.scheduleBuilder(...args),
        addTeardown(teardown) {
            // No-op as Nx doesn't require an implementation of this function
            return;
        },
        reportProgress(...args) {
            // No-op as Nx doesn't require an implementation of this function
            return;
        },
        reportRunning(...args) {
            // No-op as Nx doesn't require an implementation of this function
            return;
        },
        reportStatus(status) {
            // No-op as Nx doesn't require an implementation of this function
            return;
        },
        getBuilderNameForTarget,
        getProjectMetadata,
        validateOptions,
        getTargetOptions,
    };
    return builderContext;
}
async function scheduleTarget(root, opts, verbose, projectGraph) {
    const { Architect } = require('@angular-devkit/architect');
    const logger = (0, exports.getLogger)(verbose);
    const fsHost = new NxScopedHostForBuilders(root, projectGraph);
    const { workspace } = await core_1.workspaces.readWorkspace('angular.json', core_1.workspaces.createWorkspaceHost(fsHost));
    const architectHost = await getWrappedWorkspaceNodeModulesArchitectHost(workspace, root, opts.projects);
    const project = workspace.projects.get(opts.project);
    if (!project) {
        throw new Error(`Cannot find project '${opts.project}' in the workspace`);
    }
    if (!project.targets?.get(opts.target)) {
        throw new Error(`Cannot find target '${opts.target}' for project '${opts.project}'`);
    }
    const builderName = project.targets.get(opts.target).builder;
    if (!builderName) {
        throw new Error(`Cannot find the builder for the target '${opts.target}' of project '${opts.project}'`);
    }
    const isAngularBuild = builderName.startsWith('@angular/build:') ||
        ['@nx/angular:application', '@nx/angular:unit-test'].includes(builderName);
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(getUndefinedDefaultsTransform(isAngularBuild));
    registry.addSmartDefaultProvider('unparsed', () => {
        // This happens when context.scheduleTarget is used to run a target using nx:run-commands
        return [];
    });
    const architect = new Architect(architectHost, registry);
    const run = await architect.scheduleTarget({
        project: opts.project,
        target: opts.target,
        configuration: opts.configuration,
    }, opts.runOptions, { logger });
    let lastOutputError;
    return run.output.pipe((0, operators_1.tap)((output) => (lastOutputError = !output.success ? output.error : undefined), (error) => { }, // do nothing, this could be an intentional error
    () => {
        lastOutputError ? logger.error(lastOutputError) : 0;
    }));
}
function createNodeModulesEngineHost(resolvePaths, projects) {
    const NodeModulesEngineHost = require('@angular-devkit/schematics/tools')
        .NodeModulesEngineHost;
    class NxNodeModulesEngineHost extends NodeModulesEngineHost {
        constructor() {
            super(resolvePaths);
        }
        _resolveCollectionPath(name, requester) {
            let collectionFilePath;
            const paths = requester
                ? [(0, path_1.dirname)(requester), ...(resolvePaths || [])]
                : resolvePaths || [];
            if (name.endsWith('.json')) {
                collectionFilePath = require.resolve(name, { paths });
            }
            else {
                const { json: { generators, schematics }, path: packageJsonPath, } = (0, plugins_1.readPluginPackageJson)(name, projects, paths);
                if (!schematics && !generators) {
                    throw new Error(`The "${name}" package does not support Nx generators or Angular Devkit schematics.`);
                }
                collectionFilePath = require.resolve((0, path_1.join)((0, path_1.dirname)(packageJsonPath), schematics ?? generators));
            }
            return collectionFilePath;
        }
        _transformCollectionDescription(name, desc) {
            desc.schematics ??= desc.generators;
            return super._transformCollectionDescription(name, desc);
        }
    }
    return new NxNodeModulesEngineHost();
}
function createWorkflow(fsHost, root, opts, projects) {
    const NodeWorkflow = require('@angular-devkit/schematics/tools').NodeWorkflow;
    const workflow = new NodeWorkflow(fsHost, {
        force: false,
        dryRun: opts.dryRun,
        packageManager: (0, package_manager_1.detectPackageManager)(),
        root: (0, core_1.normalize)(root),
        registry: new core_1.schema.CoreSchemaRegistry(require('@angular-devkit/schematics').formats.standardFormats),
        resolvePaths: [process.cwd(), root],
        engineHostCreator: (options) => createNodeModulesEngineHost(options.resolvePaths, projects),
    });
    workflow.registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    workflow.engineHost.registerOptionsTransform(require('@angular-devkit/schematics/tools').validateOptionsWithSchema(workflow.registry));
    if (opts.interactive) {
        workflow.registry.usePromptProvider(createPromptProvider());
    }
    return workflow;
}
function getCollection(workflow, name) {
    const collection = workflow.engine.createCollection(name);
    if (!collection)
        throw new Error(`Cannot find collection '${name}'`);
    return collection;
}
async function createRecorder(host, record, logger) {
    return (event) => {
        let eventPath = event.path.startsWith('/')
            ? event.path.slice(1)
            : event.path;
        if (event.kind === 'error') {
            record.error = true;
            logger.warn(`ERROR! ${eventPath} ${event.description == 'alreadyExist'
                ? 'already exists'
                : 'does not exist.'}.`);
        }
        else if (event.kind === 'update') {
            record.loggingQueue.push(core_1.tags.oneLine `${pc.white('UPDATE')} ${eventPath}`);
        }
        else if (event.kind === 'create') {
            record.loggingQueue.push(core_1.tags.oneLine `${pc.green('CREATE')} ${eventPath}`);
        }
        else if (event.kind === 'delete') {
            record.loggingQueue.push(`${pc.yellow('DELETE')} ${eventPath}`);
        }
        else if (event.kind === 'rename') {
            record.loggingQueue.push(`${pc.blue('RENAME')} ${eventPath} => ${event.to}`);
        }
    };
}
async function runSchematic(host, root, workflow, logger, opts, schematic, printDryRunMessage = true, recorder = null) {
    const record = { loggingQueue: [], error: false };
    workflow.reporter.subscribe(recorder || (await createRecorder(host, record, logger)));
    try {
        await workflow
            .execute({
            collection: opts.collectionName,
            schematic: opts.generatorName,
            options: opts.generatorOptions,
            debug: false,
            logger,
        })
            .toPromise();
    }
    catch (e) {
        console.error(e);
        throw e;
    }
    if (!record.error) {
        record.loggingQueue.forEach((log) => logger.info(log));
    }
    if (opts.dryRun && printDryRunMessage) {
        logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
    }
    return { status: 0, loggingQueue: record.loggingQueue };
}
class NxScopedHost extends core_1.virtualFs.ScopedHost {
    constructor(root, _projectGraph) {
        super(new node_1.NodeJsSyncHost(), (0, core_1.normalize)(root));
        this.root = root;
        this._projectGraph = _projectGraph;
    }
    read(path) {
        if ((path === 'angular.json' || path === '/angular.json') &&
            (0, angular_json_1.isAngularPluginInstalled)()) {
            return this.readMergedWorkspaceConfiguration().pipe(
            // structuredClone to avoid toOldFormat mutating shared graph objects
            (0, operators_1.map)((r) => stringToArrayBuffer(JSON.stringify((0, angular_json_1.toOldFormat)(structuredClone(r))))));
        }
        else {
            return super.read(path);
        }
    }
    readMergedWorkspaceConfiguration() {
        return (0, rxjs_1.zip)(this._projectGraph ? (0, rxjs_1.of)(this._projectGraph) : (0, rxjs_1.from)(getProjectGraph()), this.readExistingAngularJson(), this.readJson('nx.json')).pipe((0, operators_1.concatMap)(([graph, angularJson, nxJson]) => {
            const workspaceConfig = (angularJson || { projects: {} });
            workspaceConfig.cli ??= nxJson.cli;
            workspaceConfig.schematics ??= nxJson.generators;
            const projectJsonReads = [];
            for (let projectName of Object.keys(graph.nodes)) {
                if (!workspaceConfig.projects[projectName]) {
                    projectJsonReads.push((0, rxjs_1.zip)((0, rxjs_1.of)(projectName), this.readJson((0, path_1.join)(graph.nodes[projectName].data.root, 'project.json'))));
                }
            }
            return (0, rxjs_1.zip)(...projectJsonReads).pipe((0, operators_1.map)((reads) => {
                reads
                    .filter(([, p]) => p !== null)
                    .forEach(([projectName, project]) => {
                    workspaceConfig.projects[projectName] = {
                        ...project,
                        root: graph.nodes[projectName].data.root,
                    };
                });
                return workspaceConfig;
            }));
        }), (0, operators_1.catchError)((err) => {
            console.error('Unable to read angular.json');
            console.error(err);
            process.exit(1);
        }));
    }
    write(path, content) {
        if (path === 'angular.json' || path === '/angular.json') {
            const configV2 = (0, angular_json_1.toNewFormat)((0, json_2.parseJson)(content.toString()));
            const root = this.root;
            return (0, rxjs_1.zip)(this.readMergedWorkspaceConfiguration(), this.readExistingAngularJson()).pipe((0, operators_1.concatMap)((arg) => {
                const existingConfig = arg[0];
                const existingAngularJson = arg[1];
                const projectsInAngularJson = existingAngularJson
                    ? Object.keys(existingAngularJson.projects)
                    : [];
                const projects = configV2.projects;
                const allObservables = [];
                Object.keys(projects).forEach((projectName) => {
                    if (!projectsInAngularJson.includes(projectName)) {
                        // Restore tokens in options if they were present before
                        const previousProject = existingConfig.projects[projectName];
                        const newProject = projects[projectName];
                        if (previousProject &&
                            newProject.targets &&
                            previousProject.targets) {
                            for (const [targetName, target] of Object.entries(newProject.targets)) {
                                const previousTarget = previousProject.targets[targetName];
                                if (target.options &&
                                    previousTarget &&
                                    previousTarget.options) {
                                    target.options = restoreNxTokensInOptions(target.options, previousTarget.options, newProject);
                                }
                                if (target.configurations &&
                                    previousTarget &&
                                    previousTarget.configurations) {
                                    for (const [configName, config] of Object.entries(target.configurations)) {
                                        if (previousTarget.configurations[configName]) {
                                            target.configurations[configName] =
                                                restoreNxTokensInOptions(config, previousTarget.configurations[configName], newProject);
                                        }
                                    }
                                }
                            }
                        }
                        (0, project_configuration_1.updateProjectConfiguration)({
                            root,
                            exists: () => true,
                            write: (path, content) => {
                                if (existingConfig.projects[projectName]) {
                                    const updatedContent = this.mergeProjectConfiguration(existingConfig.projects[projectName], projects[projectName], projectName);
                                    if (updatedContent) {
                                        delete updatedContent.root;
                                        allObservables.push(super.write(path, stringToArrayBuffer(JSON.stringify(updatedContent, null, 2))));
                                    }
                                }
                                else {
                                    allObservables.push(super.write(path, stringToArrayBuffer(content)));
                                }
                            },
                        }, projectName, projects[projectName]);
                    }
                });
                return (0, rxjs_1.concat)(...allObservables);
            }));
        }
        else {
            return super.write(path, content);
        }
    }
    isFile(path) {
        if (path === 'angular.json' || path === '/angular.json') {
            return (0, rxjs_1.of)(true);
        }
        else {
            return super.isFile(path);
        }
    }
    exists(path) {
        if (path === 'angular.json' || path === '/angular.json') {
            return (0, rxjs_1.of)(true);
        }
        else {
            return super.exists(path);
        }
    }
    mergeProjectConfiguration(existing, updated, projectName) {
        const res = { ...existing };
        let modified = false;
        function updatePropertyIfDifferent(property) {
            if (typeof res[property] === 'string') {
                if (res[property] !== updated[property]) {
                    res[property] = updated[property];
                    modified = true;
                }
            }
            else if (JSON.stringify(res[property]) !== JSON.stringify(updated[property])) {
                res[property] = updated[property];
                modified = true;
            }
        }
        if (!res.name || (updated.name && res.name !== updated.name)) {
            res.name ??= updated.name || projectName;
            modified = true;
        }
        updatePropertyIfDifferent('projectType');
        updatePropertyIfDifferent('sourceRoot');
        updatePropertyIfDifferent('prefix');
        updatePropertyIfDifferent('targets');
        updatePropertyIfDifferent('generators');
        updatePropertyIfDifferent('implicitDependencies');
        updatePropertyIfDifferent('tags');
        return modified ? res : null;
    }
    readExistingAngularJson() {
        return this.readJson('angular.json');
    }
    readJson(path) {
        return super
            .exists(path)
            .pipe((0, operators_1.concatMap)((r) => r
            ? super
                .read(path)
                .pipe((0, operators_1.map)((r) => (0, json_2.parseJson)(arrayBufferToString(r))))
            : (0, rxjs_1.of)(null)));
    }
}
exports.NxScopedHost = NxScopedHost;
/**
 * Host used by Angular CLI builders. It reads the project configurations from
 * the project graph to access the expanded targets.
 */
class NxScopedHostForBuilders extends NxScopedHost {
    constructor(root, projectGraph) {
        super(root, projectGraph);
    }
    readMergedWorkspaceConfiguration() {
        return (0, rxjs_1.zip)((0, rxjs_1.of)(this._projectGraph), this.readExistingAngularJson(), this.readJson('nx.json')).pipe((0, operators_1.map)(([graph, angularJson, nxJson]) => {
            const workspaceConfig = (angularJson || { projects: {} });
            workspaceConfig.cli ??= nxJson.cli;
            workspaceConfig.schematics ??= nxJson.generators;
            for (const projectName of Object.keys(graph.nodes)) {
                workspaceConfig.projects[projectName] ??= {
                    ...graph.nodes[projectName].data,
                };
            }
            return workspaceConfig;
        }), (0, operators_1.catchError)((err) => {
            console.error('Unable to read angular.json');
            console.error(err);
            process.exit(1);
        }));
    }
}
exports.NxScopedHostForBuilders = NxScopedHostForBuilders;
function arrayBufferToString(buffer) {
    const array = new Uint8Array(buffer);
    let result = '';
    const chunkSize = 8 * 1024;
    let i = 0;
    for (i = 0; i < array.length / chunkSize; i++) {
        result += String.fromCharCode.apply(null, array.subarray(i * chunkSize, (i + 1) * chunkSize));
    }
    result += String.fromCharCode.apply(null, array.subarray(i * chunkSize));
    return result;
}
/**
 * Host used by Angular CLI schematics. It reads the project configurations from
 * the project configuration files.
 */
class NxScopeHostUsedForWrappedSchematics extends NxScopedHost {
    constructor(root, host, projectGraph) {
        super(root, projectGraph);
        this.host = host;
    }
    read(path) {
        if ((path === 'angular.json' || path === '/angular.json') &&
            (0, angular_json_1.isAngularPluginInstalled)()) {
            // Replace the Nx-specific tokens in all target options
            const projects = Object.fromEntries((0, project_configuration_1.getProjects)(this.host));
            for (const [projectName, project] of Object.entries(projects)) {
                if (project.targets) {
                    for (const [targetName, target] of Object.entries(project.targets)) {
                        if (target.options) {
                            target.options = (0, target_merging_1.resolveNxTokensInOptions)(target.options, { ...project, name: projectName }, `${projectName}:${targetName}`);
                        }
                        if (target.configurations) {
                            for (const [configName, config] of Object.entries(target.configurations)) {
                                target.configurations[configName] = (0, target_merging_1.resolveNxTokensInOptions)(config, { ...project, name: projectName }, `${projectName}:${targetName}:${configName}`);
                            }
                        }
                    }
                }
            }
            const projectJsonConfig = (0, angular_json_1.toOldFormat)({ projects });
            return super.readExistingAngularJson().pipe((0, operators_1.map)((angularJson) => {
                if (angularJson) {
                    return stringToArrayBuffer(JSON.stringify({
                        version: 1,
                        projects: {
                            ...projectJsonConfig.projects,
                            ...angularJson.projects,
                        },
                    }));
                }
                else {
                    return stringToArrayBuffer(JSON.stringify(projectJsonConfig));
                }
            }));
        }
        else {
            const match = findMatchingFileChange(this.host, path);
            if (match) {
                return (0, rxjs_1.of)(bufferToArrayBuffer(Buffer.from(match.content)));
            }
            else {
                return super.read(path);
            }
        }
    }
    exists(path) {
        if (this.host.exists(path)) {
            return (0, rxjs_1.of)(true);
        }
        else if (path === 'angular.json' || path === '/angular.json') {
            return (0, rxjs_1.of)(true);
        }
        else {
            return super.exists(path);
        }
    }
    isDirectory(path) {
        if (this.host.exists(path) && !this.host.isFile(path)) {
            return (0, rxjs_1.of)(true);
        }
        else if (path === 'angular.json' || path === '/angular.json') {
            return (0, rxjs_1.of)(false);
        }
        else {
            return super.isDirectory(path);
        }
    }
    isFile(path) {
        if (this.host.isFile(path)) {
            return (0, rxjs_1.of)(true);
        }
        else if (path === 'angular.json' || path === '/angular.json') {
            return (0, rxjs_1.of)(true);
        }
        else {
            return super.isFile(path);
        }
    }
    list(path) {
        const fragments = this.host.children(path).map((child) => (0, core_1.fragment)(child));
        return (0, rxjs_1.of)(fragments);
    }
}
exports.NxScopeHostUsedForWrappedSchematics = NxScopeHostUsedForWrappedSchematics;
function findMatchingFileChange(host, path) {
    const targetPath = (0, core_1.normalize)(path.startsWith('/') ? path.substring(1) : path.toString());
    return host
        .listChanges()
        .find((f) => f.type !== 'DELETE' && (0, core_1.normalize)(f.path) === targetPath);
}
async function generate(root, opts, projects, verbose, projectGraph) {
    const logger = (0, exports.getLogger)(verbose);
    const fsHost = new NxScopeHostUsedForWrappedSchematics(root, new tree_1.FsTree(root, verbose, `ng-cli generator: ${opts.collectionName}:${opts.generatorName}`), projectGraph);
    const workflow = createWorkflow(fsHost, root, opts, projects);
    const collection = getCollection(workflow, opts.collectionName);
    const schematic = collection.createSchematic(opts.generatorName, true);
    return (await runSchematic(fsHost, root, workflow, logger, { ...opts, generatorName: schematic.description.name }, schematic)).status;
}
function createPromptProvider() {
    return (definitions) => {
        const questions = definitions.map((definition) => {
            const question = {
                name: definition.id,
                message: definition.message,
            };
            if (definition.default) {
                question.initial = definition.default;
            }
            const validator = definition.validator;
            if (validator) {
                question.validate = (input) => validator(input);
            }
            switch (definition.type) {
                case 'string':
                case 'input':
                    return { ...question, type: 'input' };
                case 'boolean':
                case 'confirmation':
                case 'confirm':
                    return { ...question, type: 'confirm' };
                case 'number':
                case 'numeral':
                    return { ...question, type: 'numeral' };
                case 'list':
                    return {
                        ...question,
                        type: !!definition.multiselect ? 'multiselect' : 'select',
                        choices: definition.items &&
                            definition.items.map((item) => {
                                if (typeof item == 'string') {
                                    return item;
                                }
                                else {
                                    return {
                                        message: item.label,
                                        name: item.value,
                                    };
                                }
                            }),
                    };
                default:
                    return { ...question, type: definition.type };
            }
        });
        return require('enquirer').prompt(questions);
    };
}
async function runMigration(root, packageName, migrationName, projects, isVerbose, projectGraph) {
    const logger = (0, exports.getLogger)(isVerbose);
    const fsHost = new NxScopeHostUsedForWrappedSchematics(root, new tree_1.FsTree(root, isVerbose, `ng-cli migration: ${packageName}:${migrationName}`), projectGraph);
    const workflow = createWorkflow(fsHost, root, {}, projects);
    const collection = resolveMigrationsCollection(packageName);
    const record = { loggingQueue: [], error: false };
    workflow.reporter.subscribe(await createRecorder(fsHost, record, logger));
    await workflow
        .execute({
        collection,
        schematic: migrationName,
        options: {},
        debug: false,
        logger: logger,
    })
        .toPromise();
    return {
        loggingQueue: record.loggingQueue,
        madeChanges: record.loggingQueue.length > 0,
    };
}
function resolveMigrationsCollection(name) {
    let collectionPath = undefined;
    if (name.startsWith('.') || name.startsWith('/')) {
        name = (0, path_1.resolve)(name);
    }
    if ((0, path_1.extname)(name)) {
        collectionPath = require.resolve(name);
    }
    else {
        const { path: packageJsonPath, packageJson } = (0, package_json_1.readModulePackageJson)(name, (0, installation_directory_1.getNxRequirePaths)(process.cwd()));
        let pkgJsonSchematics = packageJson['nx-migrations'] ?? packageJson['ng-update'];
        if (!pkgJsonSchematics) {
            throw new Error(`Could not find migrations in package: "${name}"`);
        }
        if (typeof pkgJsonSchematics != 'string') {
            pkgJsonSchematics = pkgJsonSchematics.migrations;
        }
        collectionPath = require.resolve(pkgJsonSchematics, {
            paths: [(0, path_1.dirname)(packageJsonPath)],
        });
    }
    try {
        if (collectionPath) {
            (0, fileutils_1.readJsonFile)(collectionPath);
            return collectionPath;
        }
    }
    catch {
        throw new Error(`Invalid migration file in package: "${name}"`);
    }
    throw new Error(`Collection cannot be resolved: "${name}"`);
}
let collectionResolutionOverrides = null;
let mockedSchematics = null;
/**
 * If you have an Nx Devkit generator invoking the wrapped Angular Devkit schematic,
 * and you don't want the Angular Devkit schematic to run, you can mock it up using this function.
 *
 * Unfortunately, there are some edge cases in the Nx-Angular devkit integration that
 * can be seen in the unit tests context. This function is useful for handling that as well.
 *
 * In this case, you can mock it up.
 *
 * Example:
 *
 * ```typescript
 *   mockSchematicsForTesting({
 *     'mycollection:myschematic': (tree, params) => {
 *        tree.write("README.md");
 *     }
 *   });
 *
 * ```
 */
function mockSchematicsForTesting(schematics) {
    mockedSchematics = schematics;
}
function wrapAngularDevkitSchematic(collectionName, generatorName) {
    // This is idempotent, if it happens to get called
    // multiple times its no big deal. It ensures that some
    // patches are applied to @angular-devkit code which
    // are necessary. For the most part, our wrapped host hits
    // the necessary areas, but for some things it wouldn't make
    // sense for the adapter to be 100% accurate.
    //
    // e.g. Angular warns about tags, but some angular CLI schematics
    // were written with Nx in mind, and may care about tags.
    require('./compat');
    return async (host, generatorOptions) => {
        const graph = await getProjectGraph();
        const { projects } = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(graph);
        if (mockedSchematics &&
            mockedSchematics[`${collectionName}:${generatorName}`]) {
            return await mockedSchematics[`${collectionName}:${generatorName}`](host, generatorOptions);
        }
        const recorder = (event) => {
            let eventPath = event.path.startsWith('/')
                ? event.path.slice(1)
                : event.path;
            if (event.kind === 'error') {
            }
            else if (event.kind === 'update') {
                // Apply special handling for the angular.json file, but only when in an Nx workspace
                if (eventPath === 'angular.json' && (0, angular_json_1.isAngularPluginInstalled)()) {
                    saveProjectsConfigurationsInWrappedSchematic(host, event.content.toString());
                }
                else {
                    host.write(eventPath, toBufferOrString(event.content));
                }
            }
            else if (event.kind === 'create') {
                host.write(eventPath, toBufferOrString(event.content));
            }
            else if (event.kind === 'delete') {
                host.delete(eventPath);
            }
            else if (event.kind === 'rename') {
                host.rename(eventPath, event.to);
            }
        };
        const fsHost = new NxScopeHostUsedForWrappedSchematics(host.root, host, graph);
        const logger = (0, exports.getLogger)(generatorOptions.verbose);
        const options = {
            generatorOptions,
            dryRun: true,
            interactive: false,
            help: false,
            debug: false,
            collectionName,
            generatorName,
            force: false,
            defaults: false,
            quiet: false,
        };
        const workflow = createWorkflow(fsHost, host.root, options, projects);
        // used for testing
        if (collectionResolutionOverrides) {
            const r = workflow.engineHost.resolve;
            workflow.engineHost.resolve = (collection, b, c) => {
                if (collectionResolutionOverrides[collection]) {
                    return collectionResolutionOverrides[collection];
                }
                else {
                    return r.apply(workflow.engineHost, [collection, b, c]);
                }
            };
        }
        const collection = getCollection(workflow, collectionName);
        const schematic = collection.createSchematic(generatorName, true);
        const res = await runSchematic(fsHost, host.root, workflow, logger, options, schematic, false, recorder);
        if (res.status !== 0) {
            throw new Error(res.loggingQueue.join('\n'));
        }
        const { lastValueFrom } = require('rxjs');
        const toPromise = (obs) => lastValueFrom ? lastValueFrom(obs) : obs.toPromise();
        return async () => {
            // https://github.com/angular/angular-cli/blob/344193f79d880177e421cff85dd3e94338d07420/packages/angular_devkit/schematics/src/workflow/base.ts#L194-L200
            await toPromise(workflow.engine
                .executePostTasks()
                .pipe((0, operators_1.defaultIfEmpty)(undefined), (0, operators_1.last)()));
        };
    };
}
let logger;
const getLogger = (isVerbose = false) => {
    if (!logger) {
        logger = (0, node_1.createConsoleLogger)(isVerbose, process.stdout, process.stderr, {
            warn: (s) => pc.bold(pc.yellow(s)),
            error: (s) => {
                if (s.startsWith('NX ')) {
                    return `\n${logger_1.NX_ERROR} ${pc.bold(pc.red(s.slice(3)))}\n`;
                }
                return pc.bold(pc.red(s));
            },
            info: (s) => {
                if (s.startsWith('NX ')) {
                    return `\n${logger_1.NX_PREFIX} ${pc.bold(s.slice(3))}\n`;
                }
                return pc.white(s);
            },
        });
    }
    return logger;
};
exports.getLogger = getLogger;
function saveProjectsConfigurationsInWrappedSchematic(host, content) {
    const projects = (0, angular_json_1.toNewFormat)((0, json_2.parseJson)(content)).projects;
    const existingProjects = (0, project_configuration_1.getProjects)(host);
    const existingAngularJson = host.exists('angular.json')
        ? (0, json_1.readJson)(host, 'angular.json')
        : null;
    const projectsInAngularJson = existingAngularJson
        ? Object.keys(existingAngularJson.projects)
        : [];
    const newAngularJson = existingAngularJson || {};
    // Reset projects in order to rebuild them, but leave other properties untouched
    newAngularJson.projects = {};
    Object.keys(projects).forEach((projectName) => {
        if (projectsInAngularJson.includes(projectName)) {
            newAngularJson.projects[projectName] = projects[projectName];
        }
        else {
            if (existingProjects.has(projectName)) {
                if (JSON.stringify(existingProjects.get(projectName)) !==
                    JSON.stringify(projects[projectName])) {
                    (0, project_configuration_1.updateProjectConfiguration)(host, projectName, projects[projectName]);
                }
            }
            else {
                (0, project_configuration_1.addProjectConfiguration)(host, projectName, projects[projectName]);
            }
        }
    });
    if (Object.keys(newAngularJson.projects).length > 0) {
        host.write('angular.json', JSON.stringify((0, angular_json_1.toOldFormat)(newAngularJson), null, 2));
    }
}
async function getWrappedWorkspaceNodeModulesArchitectHost(workspace, root, projects) {
    const { WorkspaceNodeModulesArchitectHost: AngularWorkspaceNodeModulesArchitectHost, } = await (0, handle_import_1.handleImport)('@angular-devkit/architect/node/index.js');
    class WrappedWorkspaceNodeModulesArchitectHost extends AngularWorkspaceNodeModulesArchitectHost {
        constructor(workspace, root, projects) {
            super(workspace, root);
            this.workspace = workspace;
            this.root = root;
            this.projects = projects;
        }
        async resolveBuilder(builderStr) {
            const [packageName, builderName] = builderStr.split(':');
            const { executorsFilePath, executorConfig } = this.readExecutorsJson(packageName, builderName);
            const builderInfo = this.readExecutor(packageName, builderName);
            return {
                name: builderStr,
                builderName,
                description: executorConfig.description,
                optionSchema: builderInfo.schema,
                import: (0, schema_utils_1.resolveImplementation)(executorConfig.implementation, (0, path_1.dirname)(executorsFilePath), packageName, this.projects),
            };
        }
        readExecutorsJson(nodeModule, builder, extraRequirePaths = []) {
            const { json: packageJson, path: packageJsonPath } = (0, plugins_1.readPluginPackageJson)(nodeModule, this.projects, this.root
                ? [this.root, __dirname, ...extraRequirePaths]
                : [__dirname, ...extraRequirePaths]);
            const executorsFile = packageJson.executors ?? packageJson.builders;
            if (!executorsFile) {
                throw new Error(`The "${nodeModule}" package does not support Nx executors or Angular Devkit Builders.`);
            }
            const basePath = (0, path_1.dirname)(packageJsonPath);
            const executorsFilePath = require.resolve((0, path_1.join)(basePath, executorsFile));
            const executorsJson = (0, fileutils_1.readJsonFile)(executorsFilePath);
            const executorConfig = executorsJson.builders?.[builder] ?? executorsJson.executors?.[builder];
            if (!executorConfig) {
                throw new Error(`Cannot find builder '${builder}' in ${executorsFilePath}.`);
            }
            if (typeof executorConfig === 'string') {
                // Angular CLI can have a builder pointing to another package:builder
                const [packageName, executorName] = executorConfig.split(':');
                return this.readExecutorsJson(packageName, executorName, [basePath]);
            }
            return { executorsFilePath, executorConfig, isNgCompat: true };
        }
        readExecutor(nodeModule, executor) {
            try {
                const { executorsFilePath, executorConfig, isNgCompat } = this.readExecutorsJson(nodeModule, executor);
                const executorsDir = (0, path_1.dirname)(executorsFilePath);
                const schemaPath = (0, schema_utils_1.resolveSchema)(executorConfig.schema, executorsDir, nodeModule, this.projects);
                const schema = (0, executor_utils_1.normalizeExecutorSchema)((0, fileutils_1.readJsonFile)(schemaPath));
                const implementationFactory = this.getImplementationFactory(executorConfig.implementation, executorsDir, nodeModule);
                const batchImplementationFactory = executorConfig.batchImplementation
                    ? this.getImplementationFactory(executorConfig.batchImplementation, executorsDir, nodeModule)
                    : null;
                const hasherFactory = executorConfig.hasher
                    ? this.getImplementationFactory(executorConfig.hasher, executorsDir, nodeModule)
                    : null;
                return {
                    schema,
                    implementationFactory,
                    batchImplementationFactory,
                    hasherFactory,
                    isNgCompat,
                };
            }
            catch (e) {
                throw new Error(`Unable to resolve ${nodeModule}:${executor}.\n${e.message}`);
            }
        }
        getImplementationFactory(implementation, executorsDir, packageName) {
            return (0, schema_utils_1.getImplementationFactory)(implementation, executorsDir, packageName, this.projects);
        }
    }
    return new WrappedWorkspaceNodeModulesArchitectHost(workspace, root, projects);
}
/**
 * Restores Nx tokens in options when possible by comparing new and previous
 * options.
 * The function preserves tokens in the following cases:
 * 1. When the resolved previous value matches the new value exactly
 * 2. When the previous value used {workspaceRoot}
 * 3. When the previous value used {projectRoot} and the new value starts with
 *    the project root path
 * Those are the only safe cases, for all other cases, the new value is used as-is.
 */
function restoreNxTokensInOptions(newOptions, previousOptions, project) {
    if (!newOptions || !previousOptions) {
        return newOptions;
    }
    const result = Array.isArray(newOptions)
        ? [...newOptions]
        : { ...newOptions };
    const resolvedPreviousOptions = (0, target_merging_1.resolveNxTokensInOptions)(previousOptions, project, '');
    for (const key of Object.keys(newOptions)) {
        const newValue = newOptions[key];
        const previousValue = previousOptions[key];
        if (typeof newValue === 'string' && typeof previousValue === 'string') {
            if (resolvedPreviousOptions[key] === newValue) {
                // If the resolved previous value matches the new value, use the previous
                // value (potentially with tokens)
                result[key] = previousValue;
            }
            else if (previousValue.startsWith('{workspaceRoot}/')) {
                // If the previous value started with {workspaceRoot}, prefix the new
                // value with {workspaceRoot}
                result[key] = `{workspaceRoot}/${newValue.replace(/^\//, '')}`;
            }
            else if (previousValue.startsWith('{projectRoot}/') &&
                newValue.startsWith(`${project.root}/`)) {
                // If the previous value started with {projectRoot} and the new value
                // starts with the project root, replace the project root with the
                // {projectRoot} token
                result[key] = newValue.replace(`${project.root}/`, '{projectRoot}/');
            }
            else {
                // Otherwise, use the new value as-is
                result[key] = newValue;
            }
        }
        else if (typeof newValue === 'object' &&
            typeof previousValue === 'object' &&
            newValue &&
            previousValue) {
            result[key] = restoreNxTokensInOptions(newValue, previousValue, project);
        }
        else {
            result[key] = newValue;
        }
    }
    return result;
}
function toBufferOrString(content) {
    if (Buffer.isBuffer(content) || typeof content === 'string') {
        return content;
    }
    // it's an ArrayBuffer
    return Buffer.from(content);
}
function stringToArrayBuffer(str) {
    return new TextEncoder().encode(str).buffer;
}
function bufferToArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
