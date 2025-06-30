// Set environment variable for documentation generation
process.env.NX_GENERATE_DOCS_PROCESS = 'true';

export interface ParsedCommandOption {
  name: string[];
  type: string;
  description: string;
  default: string;
  deprecated: boolean | string;
  hidden: boolean;
  choices?: string[];
}

export interface ParsedCommand {
  name: string;
  command: string;
  description: string;
  aliases: string[];
  options: ParsedCommandOption[];
}

const YargsTypes = ['array', 'count', 'string', 'boolean', 'number'];

// Helper functions adapted from the legacy documentation utils
export function getCommands(command: any) {
  return command.getInternalMethods().getCommandInstance().getCommandHandlers();
}

export async function parseCommand(
  name: string,
  command: any
): Promise<ParsedCommand> {
  // If it's not a function, return a stripped down version
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
      command: command.original || name,
      description:
        command.description || command.describe || command.desc || '',
      aliases: [],
      options: [],
    };
  }

  const yargs = await import(`yargs?r=${Math.random()}`);
  // Get options from yargs builder
  const builder = await command.builder(yargs().getInternalMethods().reset());

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

  // Extract options
  const options: ParsedCommandOption[] = Object.keys(builderDescriptions)
    .map((key) => ({
      name: [key, ...(builderOptions.alias[key] || [])],
      description: builderDescriptions[key]
        ? builderDescriptions[key].replace('__yargsString__:', '')
        : '',
      default: builderDefaultOptions[key] ?? builderAutomatedOptions[key],
      type: (builderOptionTypes as any)[key] || 'string',
      choices: builderOptionsChoices[key],
      deprecated: builderDeprecatedOptions[key],
      hidden: builderOptions.hiddenOptions.includes(key),
    }))
    .filter((option) => !option.hidden);

  return {
    name,
    command: command.original ? command.original.replace('$0', name) : name,
    description: command.description || command.describe || command.desc || '',
    aliases: [],
    options,
  };
}
