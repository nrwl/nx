"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printHelp = printHelp;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const string_width_1 = tslib_1.__importDefault(require("string-width"));
const logger_1 = require("./logger");
const output_1 = require("./output");
const versions_1 = require("./versions");
const package_json_1 = require("./package-json");
// cliui is the CLI layout engine developed by, and used within, yargs
// the typings for cliui do not play nice with our tsconfig, it either
// works in build or in test but not both.
const cliui = require('cliui');
function printHelp(header, schema, meta) {
    const allPositional = Object.keys(schema.properties).filter((key) => {
        const p = schema.properties[key];
        return p['$default'] && p['$default']['$source'] === 'argv';
    });
    const positional = allPositional.length > 0 ? ` [${allPositional[0]}]` : '';
    logger_1.logger.info(`
${output_1.output.applyNxPrefix('cyan', pc.bold(`${`${header + pc.cyan(positional)} ${pc.cyan('[options,...]')}`}`))}

${generateOverviewOutput({
        pluginName: meta.plugin,
        name: meta.entity,
        description: schema.description,
        mode: meta.mode,
        aliases: meta.mode === 'generate' ? meta.aliases : [],
    })}
${generateOptionsOutput(schema)}
${generateExamplesOutput(schema)}
${generateLinkOutput({
        pluginName: meta.plugin,
        name: meta.entity,
        type: meta.mode === 'generate' ? 'generators' : 'executors',
    })}
`);
}
function generateOverviewOutput({ pluginName, name, description, mode, aliases, }) {
    switch (mode) {
        case 'generate':
            return generateGeneratorOverviewOutput({
                pluginName,
                name,
                description,
                aliases,
            });
        case 'run':
            return generateExecutorOverviewOutput({
                pluginName,
                name,
                description,
            });
        default:
            throw new Error(`Unexpected mode ${mode}`);
    }
}
function generateGeneratorOverviewOutput({ pluginName, name, description, aliases, }) {
    const ui = cliui(null);
    const overviewItemsLabelWidth = 
    // Chars in labels "From" and "Name"
    4 +
        // The `:` char
        1;
    let installedVersion;
    try {
        installedVersion = (0, package_json_1.readModulePackageJson)(pluginName).packageJson.version;
    }
    catch { }
    ui.div(...[
        {
            text: pc.bold('From:'),
            padding: [1, 0, 0, 0],
            width: overviewItemsLabelWidth,
        },
        {
            text: pluginName +
                (installedVersion ? pc.dim(` (v${installedVersion})`) : ''),
            padding: [1, 0, 0, 2],
        },
    ]);
    ui.div(...[
        {
            text: pc.bold('Name:'),
            padding: [0, 0, 0, 0],
            width: overviewItemsLabelWidth,
        },
        {
            text: `${name}${aliases.length ? pc.dim(` (aliases: ${aliases.join(', ')})`) : ''}`,
            padding: [0, 0, 0, 2],
        },
    ]);
    ui.div(...[
        {
            text: description,
            padding: [2, 0, 1, 2],
        },
    ]);
    return ui.toString();
}
function generateExecutorOverviewOutput({ pluginName, name, description, }) {
    const ui = cliui(null);
    const overviewItemsLeftPadding = 2;
    const overviewItemsLabelWidth = overviewItemsLeftPadding + 'Executor:'.length;
    ui.div(...[
        {
            text: pc.bold('Executor:'),
            padding: [1, 0, 0, 0],
            width: overviewItemsLabelWidth,
        },
        {
            text: `${pluginName}:${name}` +
                (pluginName.startsWith('@nx/') ? pc.dim(` (v${versions_1.nxVersion})`) : ''),
            padding: [1, 0, 0, 0],
        },
    ]);
    ui.div(...[
        {
            text: description,
            padding: [2, 0, 1, 2],
        },
    ]);
    return ui.toString();
}
const formatOptionVal = (maybeStr) => typeof maybeStr === 'string' ? `"${maybeStr}"` : JSON.stringify(maybeStr);
// From our JSON schemas an option could possibly have more than one valid type
const formatOptionType = (optionConfig) => {
    if (Array.isArray(optionConfig.oneOf)) {
        return optionConfig.oneOf
            .map((typeConfig) => formatOptionType(typeConfig))
            .join(' OR ');
    }
    return `[${optionConfig.type}]`;
};
function generateOptionsOutput(schema) {
    const ui = cliui(null);
    const flagAndAliasLeftPadding = 4;
    const flagAndAliasRightPadding = 4;
    // Construct option flags (including optional aliases) and descriptions and track the required space to render them
    const optionsToRender = new Map();
    let requiredSpaceToRenderAllFlagsAndAliases = 0;
    const sorted = Object.entries(schema.properties).sort((a, b) => compareByPriority(a, b, schema));
    for (const [optionName, optionConfig] of sorted) {
        const renderedFlagAndAlias = `--${optionName}` +
            (optionConfig.alias ? `, -${optionConfig.alias}` : '');
        const renderedFlagAndAliasTrueWidth = (0, string_width_1.default)(renderedFlagAndAlias);
        if (renderedFlagAndAliasTrueWidth > requiredSpaceToRenderAllFlagsAndAliases) {
            requiredSpaceToRenderAllFlagsAndAliases = renderedFlagAndAliasTrueWidth;
        }
        const renderedDescription = optionConfig.description;
        const renderedTypesAndDefault = `${formatOptionType(optionConfig)}${optionConfig.enum
            ? ` [choices: ${optionConfig.enum
                .map((e) => formatOptionVal(e))
                .join(', ')}]`
            : ''}${optionConfig.default
            ? ` [default: ${formatOptionVal(optionConfig.default)}]`
            : ''}`;
        optionConfig.hidden ??= optionConfig.visible === false;
        if (!optionConfig.hidden)
            optionsToRender.set(optionName, {
                renderedFlagAndAlias,
                renderedDescription,
                renderedTypesAndDefault,
            });
    }
    ui.div({
        text: 'Options:',
        padding: [1, 0, 0, 0],
    });
    for (const { renderedFlagAndAlias, renderedDescription, renderedTypesAndDefault, } of optionsToRender.values()) {
        const cols = [
            {
                text: renderedFlagAndAlias,
                width: requiredSpaceToRenderAllFlagsAndAliases +
                    flagAndAliasLeftPadding +
                    flagAndAliasRightPadding,
                padding: [0, flagAndAliasRightPadding, 0, flagAndAliasLeftPadding],
            },
            {
                text: renderedDescription,
                padding: [0, 0, 0, 0],
            },
            {
                text: renderedTypesAndDefault,
                padding: [0, 0, 0, 0],
                align: 'right',
            },
        ];
        ui.div(...cols);
    }
    return ui.toString();
}
function generateExamplesOutput(schema) {
    if (!schema.examples || schema.examples.length === 0) {
        return '';
    }
    const ui = cliui(null);
    const xPadding = 4;
    ui.div({
        text: 'Examples:',
        padding: [1, 0, 0, 0],
    });
    for (const { command, description } of schema.examples) {
        const cols = [
            {
                text: command,
                padding: [0, xPadding, 0, xPadding],
            },
            {
                text: description || '',
                padding: [0, 2, 0, 0],
            },
        ];
        ui.div(...cols);
    }
    return ui.toString();
}
// TODO: generalize link generation so it works for non @nx plugins as well
function generateLinkOutput({ pluginName, name, type, }) {
    const nxPackagePrefix = '@nx/';
    if (!pluginName.startsWith(nxPackagePrefix)) {
        return '';
    }
    const link = `https://nx.dev/nx-api/${pluginName.substring(nxPackagePrefix.length)}/${type}/${name}`;
    return `\n\n${pc.dim('Find more information and examples at:')} ${pc.bold(link)}`;
}
/**
 * sorts properties in the following order
 * - required
 * - x-priority: important
 * - everything else
 * - x-priority: internal
 * - deprecated
 * if two properties have equal priority, they are sorted by name
 */
function compareByPriority(a, b, schema) {
    function getPriority([name, property]) {
        if (schema.required?.includes(name)) {
            return 0;
        }
        if (property['x-priority'] === 'important') {
            return 1;
        }
        if (property['x-deprecated']) {
            return 4;
        }
        if (property['x-priority'] === 'internal') {
            return 3;
        }
        return 2;
    }
    const aPriority = getPriority(a);
    const bPriority = getPriority(b);
    if (aPriority === bPriority) {
        return a[0].localeCompare(b[0]);
    }
    return aPriority - bPriority;
}
