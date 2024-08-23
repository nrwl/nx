import * as chalk from 'chalk';
import { logger } from './logger';
import { output } from './output';
import { Schema } from './params';
import { nxVersion } from './versions';
import { readModulePackageJson } from './package-json';

// cliui is the CLI layout engine developed by, and used within, yargs
// the typings for cliui do not play nice with our tsconfig, it either
// works in build or in test but not both.
const cliui = require('cliui') as typeof import('cliui')['default'];

export function printHelp(
  header: string,
  schema: Schema,
  meta:
    | { mode: 'generate'; plugin: string; entity: string; aliases: string[] }
    | { mode: 'run'; plugin: string; entity: string }
) {
  const allPositional = Object.keys(schema.properties).filter((key) => {
    const p = schema.properties[key];
    return p['$default'] && p['$default']['$source'] === 'argv';
  });
  const positional = allPositional.length > 0 ? ` [${allPositional[0]}]` : '';

  logger.info(`
${output.applyNxPrefix(
  'cyan',
  chalk.bold(
    `${`${header + chalk.reset.cyan(positional)} ${chalk.reset.cyan(
      '[options,...]'
    )}`}`
  )
)}

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

function generateOverviewOutput({
  pluginName,
  name,
  description,
  mode,
  aliases,
}: {
  pluginName: string;
  name: string;
  description: string;
  mode: 'generate' | 'run';
  aliases: string[];
}): string {
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

function generateGeneratorOverviewOutput({
  pluginName,
  name,
  description,
  aliases,
}: {
  pluginName: string;
  name: string;
  description: string;
  aliases: string[];
}): string {
  const ui = cliui(null);
  const overviewItemsLabelWidth =
    // Chars in labels "From" and "Name"
    4 +
    // The `:` char
    1;

  let installedVersion: string;
  try {
    installedVersion = readModulePackageJson(pluginName).packageJson.version;
  } catch {}

  ui.div(
    ...[
      {
        text: chalk.bold('From:'),
        padding: [1, 0, 0, 0],
        width: overviewItemsLabelWidth,
      },
      {
        text:
          pluginName +
          (installedVersion ? chalk.dim(` (v${installedVersion})`) : ''),
        padding: [1, 0, 0, 2],
      },
    ]
  );

  ui.div(
    ...[
      {
        text: chalk.bold('Name:'),
        padding: [0, 0, 0, 0],
        width: overviewItemsLabelWidth,
      },
      {
        text: `${name}${
          aliases.length ? chalk.dim(` (aliases: ${aliases.join(', ')})`) : ''
        }`,
        padding: [0, 0, 0, 2],
      },
    ]
  );

  ui.div(
    ...[
      {
        text: description,
        padding: [2, 0, 1, 2],
      },
    ]
  );

  return ui.toString();
}

function generateExecutorOverviewOutput({
  pluginName,
  name,
  description,
}: {
  pluginName: string;
  name: string;
  description: string;
}): string {
  const ui = cliui(null);
  const overviewItemsLeftPadding = 2;
  const overviewItemsLabelWidth = overviewItemsLeftPadding + 'Executor:'.length;

  ui.div(
    ...[
      {
        text: chalk.bold('Executor:'),
        padding: [1, 0, 0, 0],
        width: overviewItemsLabelWidth,
      },
      {
        text:
          `${pluginName}:${name}` +
          (pluginName.startsWith('@nrwl/')
            ? chalk.dim(` (v${nxVersion})`)
            : ''),
        padding: [1, 0, 0, 0],
      },
    ]
  );

  ui.div(
    ...[
      {
        text: description,
        padding: [2, 0, 1, 2],
      },
    ]
  );

  return ui.toString();
}

const formatOptionVal = (maybeStr: unknown) =>
  typeof maybeStr === 'string' ? `"${maybeStr}"` : JSON.stringify(maybeStr);

// From our JSON schemas an option could possibly have more than one valid type
const formatOptionType = (optionConfig: Schema['properties'][0]) => {
  if (Array.isArray(optionConfig.oneOf)) {
    return optionConfig.oneOf
      .map((typeConfig) => formatOptionType(typeConfig))
      .join(' OR ');
  }
  return `[${optionConfig.type}]`;
};

function generateOptionsOutput(schema: Schema): string {
  const ui = cliui(null);
  const flagAndAliasLeftPadding = 4;
  const flagAndAliasRightPadding = 4;

  // Construct option flags (including optional aliases) and descriptions and track the required space to render them
  const optionsToRender = new Map<
    string,
    {
      renderedFlagAndAlias: string;
      renderedDescription: string;
      renderedTypesAndDefault: string;
    }
  >();
  let requiredSpaceToRenderAllFlagsAndAliases = 0;
  const sorted = Object.entries(schema.properties).sort((a, b) =>
    compareByPriority(a, b, schema)
  );
  for (const [optionName, optionConfig] of sorted) {
    const renderedFlagAndAlias =
      `--${optionName}` +
      (optionConfig.alias ? `, -${optionConfig.alias}` : '');

    const { default: stringWidth } =
      require('string-width') as typeof import('string-width');
    const renderedFlagAndAliasTrueWidth = stringWidth(renderedFlagAndAlias);
    if (
      renderedFlagAndAliasTrueWidth > requiredSpaceToRenderAllFlagsAndAliases
    ) {
      requiredSpaceToRenderAllFlagsAndAliases = renderedFlagAndAliasTrueWidth;
    }

    const renderedDescription = optionConfig.description;
    const renderedTypesAndDefault = `${formatOptionType(optionConfig)}${
      optionConfig.enum
        ? ` [choices: ${optionConfig.enum
            .map((e) => formatOptionVal(e))
            .join(', ')}]`
        : ''
    }${
      optionConfig.default
        ? ` [default: ${formatOptionVal(optionConfig.default)}]`
        : ''
    }`;

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

  for (const {
    renderedFlagAndAlias,
    renderedDescription,
    renderedTypesAndDefault,
  } of optionsToRender.values()) {
    const cols = [
      {
        text: renderedFlagAndAlias,
        width:
          requiredSpaceToRenderAllFlagsAndAliases +
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
        align: 'right' as const,
      },
    ];

    ui.div(...cols);
  }

  return ui.toString();
}

function generateExamplesOutput(schema: Schema): string {
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
function generateLinkOutput({
  pluginName,
  name,
  type,
}: {
  pluginName: string;
  name: string;
  type: 'generators' | 'executors';
}): string {
  const nxPackagePrefix = '@nx/';
  const nrwlPackagePrefix = '@nrwl/';
  if (
    !pluginName.startsWith(nxPackagePrefix) &&
    !pluginName.startsWith(nrwlPackagePrefix)
  ) {
    return '';
  }

  const link = `https://nx.dev/nx-api/${pluginName.substring(
    pluginName.startsWith(nxPackagePrefix)
      ? nxPackagePrefix.length
      : nrwlPackagePrefix.length
  )}/${type}/${name}`;

  return `\n\n${chalk.dim(
    'Find more information and examples at:'
  )} ${chalk.bold(link)}`;
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
function compareByPriority(
  a: [string, Schema['properties'][0]],
  b: [string, Schema['properties'][0]],
  schema: Schema
): number {
  function getPriority([name, property]: [
    string,
    Schema['properties'][0]
  ]): number {
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
