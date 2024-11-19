import { MenuItem } from '@nx/nx-dev/models-menu';
import { outputFileSync } from 'fs-extra';
import {
  bold,
  code,
  h2,
  lines as mdLines,
  strikethrough,
  table,
} from 'markdown-factory';
import { join } from 'path';
import { format, resolveConfig } from 'prettier';
import { CommandModule } from 'yargs';
import { stripVTControlCharacters } from 'node:util';

const importFresh = require('import-fresh');

export function sortAlphabeticallyFunction(a: string, b: string): number {
  const nameA = a.toUpperCase(); // ignore upper and lowercase
  const nameB = b.toUpperCase(); // ignore upper and lowercase
  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }
  // names must be equal
  return 0;
}

export function sortByBooleanFunction(a: boolean, b: boolean): number {
  if (a && !b) {
    return -1;
  }
  if (!a && b) {
    return 1;
  }
  return 0;
}

export async function generateMarkdownFile(
  outputDirectory: string,
  templateObject: { name: string; template: string }
): Promise<void> {
  const filePath = join(outputDirectory, `${templateObject.name}.md`);
  outputFileSync(
    filePath,
    await formatWithPrettier(
      filePath,
      stripVTControlCharacters(templateObject.template)
    )
  );
}

export async function generateJsonFile(
  filePath: string,
  json: unknown
): Promise<void> {
  outputFileSync(
    filePath,
    await formatWithPrettier(filePath, JSON.stringify(json)),
    { encoding: 'utf8' }
  );
}

function menuItemToStrings(item: MenuItem, pathPrefix = '/'): string[] {
  if (item.isExternal) {
    return [];
  }
  const line = item.path ? `- [${item.name}](${item.path})` : `- ${item.name}`;
  const padding = item.path
    .replace(pathPrefix, '')
    .split('/')
    .map(() => '  ')
    .join('');
  const childLines = item.children.flatMap((child) =>
    menuItemToStrings(child, pathPrefix)
  );
  return [padding + line, ...childLines];
}

function deduplicate<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export async function generateIndexMarkdownFile(
  filePath: string,
  json: { id: string; menu: MenuItem[] }[]
): Promise<void> {
  function capitalize(word: string) {
    const [firstLetter, ...rest] = word;
    return firstLetter.toLocaleUpperCase() + rest.join('');
  }
  const idToPathPrefix = {
    nx: undefined,
    recipes: `/recipes/`,
    plugins: `/plugins/`,
    packages: `/packages/`,
    ci: `/ci/`,
  };
  const content = json
    .map(
      ({ id, menu }) =>
        deduplicate(
          [
            `- ${capitalize(id)}`,
            ...menu.flatMap((item) =>
              menuItemToStrings(item, idToPathPrefix[id])
            ),
          ].filter((line) => line.length > 0)
        ).join('\n') + '\n'
    )
    .join(`\n`);
  outputFileSync(filePath, await formatWithPrettier(filePath, content), {
    encoding: 'utf8',
  });
}

export async function formatWithPrettier(filePath: string, content: string) {
  let options: any = {
    filepath: filePath,
  };
  const resolvedOptions = await resolveConfig(filePath);
  if (resolvedOptions) {
    options = {
      ...options,
      ...resolvedOptions,
    };
  }

  return format(content, options);
}

export function formatDescription(
  description: string,
  deprecated: boolean | string
) {
  if (!deprecated) {
    return description;
  }
  if (!description) {
    return `${bold('Deprecated:')} ${deprecated}`;
  }
  return deprecated === true
    ? `${bold('Deprecated:')} ${description}`
    : mdLines(`${bold('Deprecated:')} ${deprecated}`, description);
}

export function getCommands(command: any) {
  return command.getInternalMethods().getCommandInstance().getCommandHandlers();
}

export interface ParsedCommandOption {
  name: string;
  type: string;
  description: string;
  default: string;
  deprecated: boolean | string;
  hidden: boolean;
  choices?: string[];
}

export interface ParsedCommand {
  name: string;
  commandString: string;
  description: string;
  deprecated: string;
  options?: Array<ParsedCommandOption>;
  subcommands?: Array<ParsedCommand>;
}

const YargsTypes = ['array', 'count', 'string', 'boolean', 'number'];

export async function parseCommand(
  name: string,
  command: any
): Promise<ParsedCommand> {
  // It is not a function return a strip down version of the command
  if (
    !(
      command.builder &&
      command.builder.constructor &&
      command.builder.call &&
      command.builder.apply
    )
  ) {
    return {
      name,
      commandString: command.original,
      deprecated: command.deprecated,
      description: command.description,
    };
  }

  // Show all the options we can get from yargs
  const builder = await command.builder(
    importFresh('yargs')().getInternalMethods().reset()
  );
  const builderDescriptions = builder
    .getInternalMethods()
    .getUsageInstance()
    .getDescriptions();
  const builderOptions = builder.getOptions();
  const builderDefaultOptions = builderOptions.default;
  const builderAutomatedOptions = builderOptions.defaultDescription;
  const builderDeprecatedOptions = builder.getDeprecatedOptions();
  const builderOptionsChoices = builderOptions.choices;
  const builderOptionTypes = YargsTypes.reduce((acc, type) => {
    builderOptions[type].forEach(
      (option: any) => (acc = { ...acc, [option]: type })
    );
    return acc;
  }, {});
  const subcommands = await Promise.all(
    Object.entries(getCommands(builder))
      .filter(([, subCommandConfig]) => {
        const c = subCommandConfig as CommandModule;
        // These are all supported yargs fields for description, even though the types don't reflect that
        // @ts-ignore
        return c.description || c.describe || c.desc;
      })
      .map(([subCommandName, subCommandConfig]) =>
        parseCommand(subCommandName, subCommandConfig)
      )
  );

  return {
    name,
    description: command.description,
    commandString: command.original.replace('$0', name),
    deprecated: command.deprecated,
    options:
      Object.keys(builderDescriptions).map((key) => ({
        name: key,
        description: builderDescriptions[key]
          ? builderDescriptions[key].replace('__yargsString__:', '')
          : '',
        default: builderDefaultOptions[key] ?? builderAutomatedOptions[key],
        type: (<any>builderOptionTypes)[key],
        choices: builderOptionsChoices[key],
        deprecated: builderDeprecatedOptions[key],
        hidden: builderOptions.hiddenOptions.includes(key),
      })) || null,
    subcommands,
  };
}

export function generateOptionsMarkdown(
  command: ParsedCommand,
  extraHeadingLevels = 0
): string {
  type FieldName = 'name' | 'type' | 'description';
  const items: Record<FieldName, string>[] = [];
  const optionsField = command.subcommands?.length ? 'Shared Option' : 'Option';
  const fields: { field: FieldName; label: string }[] = [
    { field: 'name', label: optionsField },
    { field: 'type', label: 'Type' },
    { field: 'description', label: 'Description' },
  ];
  if (Array.isArray(command.options) && !!command.options.length) {
    command.options
      .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
      .filter(({ hidden }) => !hidden)
      .forEach((option) => {
        const name = option.deprecated
          ? strikethrough(code('--' + option.name))
          : code('--' + option.name);
        let description = formatDescription(
          option.description,
          option.deprecated
        );
        let type = option.type;
        if (option.choices !== undefined) {
          type = option.choices
            .map((c: any) => '`' + JSON.stringify(c).replace(/"/g, '') + '`')
            .join(', ');
        }
        if (option.default !== undefined) {
          description += ` (Default: \`${JSON.stringify(option.default).replace(
            /"/g,
            ''
          )}\`)`;
        }
        if (
          (option.name === 'version' &&
            option.description === 'Show version number') ||
          (option.name === 'help' && option.description === 'Show help')
        ) {
          // Add . to the end of the built-in description for consistency with our other descriptions
          description = `${description}.`;
        }
        items.push({ name, type, description });
      });
  }
  return h2('Options', table(items, fields));
}
