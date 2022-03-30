import { outputFileSync, readJsonSync } from 'fs-extra';
import { join } from 'path';
import { format, resolveConfig } from 'prettier';
import { dedent } from 'tslint/lib/utils';
const stripAnsi = require('strip-ansi');
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
    await formatWithPrettier(filePath, stripAnsi(templateObject.template))
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

export function getNxPackageDependencies(packageJsonPath: string): {
  name: string;
  dependencies: string[];
  peerDependencies: string[];
} {
  const packageJson = readJsonSync(packageJsonPath);
  if (!packageJson) {
    console.log(`No package.json found at: ${packageJsonPath}`);
    return null;
  }
  return {
    name: packageJson.name,
    dependencies: packageJson.dependencies
      ? Object.keys(packageJson.dependencies).filter((item) =>
          item.includes('@nrwl')
        )
      : [],
    peerDependencies: packageJson.peerDependencies
      ? Object.keys(packageJson.peerDependencies).filter((item) =>
          item.includes('@nrwl')
        )
      : [],
  };
}

export function formatDeprecated(
  description: string,
  deprecated: boolean | string
) {
  if (!deprecated) {
    return description;
  }
  return deprecated === true
    ? `**Deprecated:** ${description}`
    : `
    **Deprecated:** ${deprecated}

    ${description}
    `;
}

export function getCommands(command) {
  return command.getInternalMethods().getCommandInstance().getCommandHandlers();
}

export interface ParsedCommandOption {
  name: string;
  description: string;
  default: string;
  deprecated: boolean | string;
}

export interface ParsedCommand {
  name: string;
  commandString: string;
  description: string;
  options?: Array<ParsedCommandOption>;
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
      (option) => (acc = { ...acc, [option]: type })
    );
    return acc;
  }, {});

  return {
    name,
    description: command.description,
    commandString: command.original.replace('$0', name),
    options:
      Object.keys(builderDescriptions).map((key) => ({
        name: key,
        description: builderDescriptions[key]
          ? builderDescriptions[key].replace('__yargsString__:', '')
          : '',
        default: builderDefaultOptions[key] ?? builderAutomatedOptions[key],
        type: builderOptionTypes[key],
        choices: builderOptionsChoices[key],
        deprecated: builderDeprecatedOptions[key],
      })) || null,
  };
}

export function generateOptionsMarkdown(command): string {
  let response = '';
  if (Array.isArray(command.options) && !!command.options.length) {
    response += '\n## Options\n';

    command.options
      .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
      .forEach((option) => {
        response += dedent`
        ### ${option.deprecated ? `~~${option.name}~~` : option.name}
        `;
        if (option.type !== undefined && option.type !== '') {
          response += `Type: ${option.type}\n`;
        }
        if (option.choices !== undefined) {
          response += dedent`
          Choices: [${option.choices.map((c) => `"${c}"`).join(', ')}]\n`;
        }
        if (option.default !== undefined && option.default !== '') {
          response += dedent`
          Default: ${option.default}\n`;
        }
        response += dedent`
              ${formatDeprecated(option.description, option.deprecated)}
            `;
      });
  }
  return response;
}
