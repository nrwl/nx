"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printChanges = printChanges;
exports.parseGeneratorString = parseGeneratorString;
exports.printGenHelp = printGenHelp;
exports.generate = generate;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const enquirer_1 = require("enquirer");
const path_1 = require("path");
const configuration_1 = require("../../config/configuration");
const tree_1 = require("../../generators/tree");
const project_graph_1 = require("../../project-graph/project-graph");
const retrieve_workspace_files_1 = require("../../project-graph/utils/retrieve-workspace-files");
const logger_1 = require("../../utils/logger");
const params_1 = require("../../utils/params");
const handle_errors_1 = require("../../utils/handle-errors");
const handle_import_1 = require("../../utils/handle-import");
const local_plugins_1 = require("../../utils/plugins/local-plugins");
const print_help_1 = require("../../utils/print-help");
const workspace_root_1 = require("../../utils/workspace-root");
const calculate_default_project_name_1 = require("../../config/calculate-default-project-name");
const installed_plugins_1 = require("../../utils/plugins/installed-plugins");
const generator_utils_1 = require("./generator-utils");
const path_2 = require("../../utils/path");
const analytics_1 = require("../../analytics");
function printChanges(fileChanges) {
    fileChanges.forEach((f) => {
        if (f.type === 'CREATE') {
            console.log(`${pc.green('CREATE')} ${f.path}`);
        }
        else if (f.type === 'UPDATE') {
            console.log(`${pc.white('UPDATE')} ${f.path}`);
        }
        else if (f.type === 'DELETE') {
            console.log(`${pc.yellow('DELETE')} ${f.path}`);
        }
    });
}
async function promptForCollection(generatorName, interactive, projectsConfiguration) {
    const localPlugins = await (0, local_plugins_1.getLocalWorkspacePlugins)(projectsConfiguration, (0, configuration_1.readNxJson)());
    const installedCollections = Array.from(new Set((0, installed_plugins_1.findInstalledPlugins)().map((x) => x.name)));
    const choicesMap = new Set();
    const deprecatedChoices = new Set();
    for (const collectionName of installedCollections) {
        try {
            const { resolvedCollectionName, normalizedGeneratorName, generatorConfiguration: { ['x-deprecated']: deprecated, hidden }, } = (0, generator_utils_1.getGeneratorInformation)(collectionName, generatorName, workspace_root_1.workspaceRoot, projectsConfiguration.projects);
            if (hidden) {
                continue;
            }
            if (deprecated) {
                deprecatedChoices.add(`${resolvedCollectionName}:${normalizedGeneratorName}`);
            }
            else {
                choicesMap.add(`${resolvedCollectionName}:${normalizedGeneratorName}`);
            }
        }
        catch { }
    }
    const choicesFromLocalPlugins = [];
    for (const [name] of localPlugins) {
        try {
            const { resolvedCollectionName, normalizedGeneratorName, generatorConfiguration: { ['x-deprecated']: deprecated, hidden }, } = (0, generator_utils_1.getGeneratorInformation)(name, generatorName, workspace_root_1.workspaceRoot, projectsConfiguration.projects);
            if (hidden) {
                continue;
            }
            const value = `${resolvedCollectionName}:${normalizedGeneratorName}`;
            if (!choicesMap.has(value)) {
                if (deprecated) {
                    deprecatedChoices.add(value);
                }
                else {
                    choicesFromLocalPlugins.push({
                        name: value,
                        message: pc.bold(value),
                        value,
                    });
                }
            }
        }
        catch { }
    }
    if (choicesFromLocalPlugins.length) {
        choicesFromLocalPlugins[choicesFromLocalPlugins.length - 1].message += '\n';
    }
    const choices = choicesFromLocalPlugins.concat(...choicesMap);
    if (choices.length === 1) {
        return typeof choices[0] === 'string' ? choices[0] : choices[0].value;
    }
    else if (!interactive && choices.length > 1) {
        throwInvalidInvocation(Array.from(choicesMap));
    }
    else if (interactive && choices.length > 1) {
        const noneOfTheAbove = `\nNone of the above`;
        choices.push(noneOfTheAbove);
        let { generator, customCollection } = await (0, enquirer_1.prompt)([
            {
                name: 'generator',
                message: `Which generator would you like to use?`,
                type: 'autocomplete',
                // enquirer's typings are incorrect here... It supports (string | Choice)[], but is typed as (string[] | Choice[])
                choices: choices,
            },
            {
                name: 'customCollection',
                type: 'input',
                message: `Which collection would you like to use?`,
                skip: function () {
                    // Skip this question if the user did not answer None of the above
                    return this.state.answers.generator !== noneOfTheAbove;
                },
                validate: function (value) {
                    if (this.skipped) {
                        return true;
                    }
                    try {
                        (0, generator_utils_1.getGeneratorInformation)(value, generatorName, workspace_root_1.workspaceRoot, projectsConfiguration.projects);
                        return true;
                    }
                    catch {
                        logger_1.logger.error(`\nCould not find ${value}:${generatorName}`);
                        return false;
                    }
                },
            },
        ]);
        return customCollection
            ? `${customCollection}:${generatorName}`
            : generator;
    }
    else if (deprecatedChoices.size > 0) {
        throw new Error([
            `All installed generators named "${generatorName}" are deprecated. To run one, provide its full \`collection:generator\` id.`,
            [...deprecatedChoices].map((x) => `  - ${x}`),
        ].join('\n'));
    }
    else {
        throw new Error(`Could not find any generators named "${generatorName}"`);
    }
}
function parseGeneratorString(value) {
    const separatorIndex = value.lastIndexOf(':');
    if (separatorIndex > 0) {
        return {
            collection: value.slice(0, separatorIndex),
            generator: value.slice(separatorIndex + 1),
        };
    }
    else {
        return {
            generator: value,
        };
    }
}
async function convertToGenerateOptions(generatorOptions, mode, projectsConfiguration) {
    let collectionName = null;
    let generatorName = null;
    const interactive = generatorOptions.interactive;
    if (mode === 'generate') {
        const generatorDescriptor = generatorOptions['generator'];
        const { collection, generator } = parseGeneratorString(generatorDescriptor);
        if (collection) {
            collectionName = collection;
            generatorName = generator;
        }
        else {
            const generatorString = await promptForCollection(generatorDescriptor, interactive, projectsConfiguration);
            const parsedGeneratorString = parseGeneratorString(generatorString);
            collectionName = parsedGeneratorString.collection;
            generatorName = parsedGeneratorString.generator;
        }
    }
    else {
        collectionName = generatorOptions.collection;
        generatorName = 'new';
    }
    const res = {
        collectionName,
        generatorName,
        generatorOptions,
        help: generatorOptions.help,
        dryRun: generatorOptions.dryRun,
        interactive,
        defaults: generatorOptions.defaults,
        quiet: generatorOptions.quiet,
    };
    delete generatorOptions.d;
    delete generatorOptions.dryRun;
    delete generatorOptions['dry-run'];
    delete generatorOptions.interactive;
    delete generatorOptions.help;
    delete generatorOptions.collection;
    delete generatorOptions.verbose;
    delete generatorOptions.generator;
    delete generatorOptions['--'];
    delete generatorOptions['$0'];
    delete generatorOptions.quiet;
    return res;
}
function throwInvalidInvocation(availableGenerators) {
    throw new Error(`Specify the generator name (e.g., nx generate ${availableGenerators.join(', ')})`);
}
function printGenHelp(opts, schema, normalizedGeneratorName, aliases) {
    (0, print_help_1.printHelp)(`generate ${opts.collectionName}:${normalizedGeneratorName}`, {
        ...schema,
        properties: schema.properties,
    }, {
        mode: 'generate',
        plugin: opts.collectionName,
        entity: normalizedGeneratorName,
        aliases,
    });
}
async function generate(args) {
    return (0, handle_errors_1.handleErrors)(args.verbose, async () => {
        const nxJsonConfiguration = (0, configuration_1.readNxJson)();
        let projectGraph;
        let projectsConfigurations;
        if (args.skipProjectGraph) {
            const projects = await (0, retrieve_workspace_files_1.retrieveProjectConfigurationsWithoutPluginInference)(workspace_root_1.workspaceRoot);
            projectsConfigurations = { version: 2, projects };
        }
        else {
            projectGraph = await (0, project_graph_1.createProjectGraphAsync)();
            projectsConfigurations =
                (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph);
        }
        const opts = await convertToGenerateOptions(args, 'generate', projectsConfigurations);
        const { normalizedGeneratorName, schema, implementationFactory, generatorConfiguration: { aliases, hidden, ['x-deprecated']: deprecated, ['x-use-standalone-layout']: isStandalonePreset, }, } = (0, generator_utils_1.getGeneratorInformation)(opts.collectionName, opts.generatorName, workspace_root_1.workspaceRoot, projectsConfigurations.projects);
        if (deprecated) {
            logger_1.logger.warn([
                `${logger_1.NX_PREFIX}: ${opts.collectionName}:${normalizedGeneratorName} is deprecated`,
                `${deprecated}`,
            ].join('\n'));
        }
        if (!opts.quiet && !opts.help) {
            logger_1.logger.info(`NX Generating ${opts.collectionName}:${normalizedGeneratorName}`);
        }
        if (opts.help) {
            printGenHelp(opts, schema, normalizedGeneratorName, aliases);
            return 0;
        }
        const cwd = (0, path_2.getCwd)();
        const combinedOpts = await (0, params_1.combineOptionsForGenerator)(opts.generatorOptions, opts.collectionName, normalizedGeneratorName, projectsConfigurations, nxJsonConfiguration, schema, opts.interactive, (0, calculate_default_project_name_1.calculateDefaultProjectName)(cwd, workspace_root_1.workspaceRoot, projectsConfigurations, nxJsonConfiguration), (0, path_1.relative)(workspace_root_1.workspaceRoot, cwd), args.verbose);
        (0, analytics_1.reportNxGenerateCommand)(`${opts.collectionName}:${normalizedGeneratorName}`);
        if ((0, generator_utils_1.getGeneratorInformation)(opts.collectionName, normalizedGeneratorName, workspace_root_1.workspaceRoot, projectsConfigurations.projects).isNxGenerator) {
            const host = new tree_1.FsTree(workspace_root_1.workspaceRoot, args.verbose, `generating (${opts.collectionName}:${normalizedGeneratorName})`);
            const implementation = implementationFactory();
            // @todo(v17): Remove this, isStandalonePreset property is defunct.
            if (normalizedGeneratorName === 'preset' && !isStandalonePreset) {
                host.write('apps/.gitkeep', '');
                host.write('libs/.gitkeep', '');
            }
            const task = await implementation(host, combinedOpts);
            host.lock();
            const changes = host.listChanges();
            if (!opts.quiet) {
                printChanges(changes);
            }
            if (!opts.dryRun) {
                (0, tree_1.flushChanges)(workspace_root_1.workspaceRoot, changes);
                if (task) {
                    await task();
                }
            }
            else {
                logger_1.logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
            }
        }
        else {
            if (!projectGraph) {
                throw new Error(`Cannot run non-Nx generators with --skipProjectGraph. Remove the flag or use an Nx generator.`);
            }
            require('../../adapter/compat');
            return (await (0, handle_import_1.handleImport)('../../adapter/ngcli-adapter.js', __dirname)).generate(workspace_root_1.workspaceRoot, {
                ...opts,
                generatorOptions: combinedOpts,
            }, projectsConfigurations.projects, args.verbose, projectGraph);
        }
    });
}
