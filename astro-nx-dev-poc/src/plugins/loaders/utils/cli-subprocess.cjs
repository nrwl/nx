const { join, resolve: pathResolve } = require('path');
const { existsSync, readFileSync } = require('fs');
const importFresh = require('import-fresh');

const workspaceRoot = process.cwd();

// Set environment variable for documentation generation
process.env.NX_GENERATE_DOCS_PROCESS = 'true';

// Register ts-node to handle TypeScript files
require('ts-node').register({
  project: join(workspaceRoot, 'tsconfig.base.json'),
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
  },
});

// Register TypeScript paths from the base config in main Nx repo
const { register: registerTsConfigPaths } = require('tsconfig-paths');
const tsconfigPath = join(workspaceRoot, 'tsconfig.base.json');
const config = JSON.parse(readFileSync(tsconfigPath, 'utf-8')).compilerOptions;
registerTsConfigPaths(config);

// Inline command parser functions
const YargsTypes = ['array', 'count', 'string', 'boolean', 'number'];

function getCommands(command) {
  return command.getInternalMethods().getCommandInstance().getCommandHandlers();
}

async function parseCommand(name, command) {
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

  const yargs = importFresh('yargs');
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
      (option) => (acc = { ...acc, [option]: type })
    );
    return acc;
  }, {});

  // Extract options
  const options = Object.keys(builderDescriptions)
    .map((key) => ({
      name: [key, ...(builderOptions.alias[key] || [])],
      description: builderDescriptions[key]
        ? builderDescriptions[key].replace('__yargsString__:', '')
        : '',
      default: builderDefaultOptions[key] ?? builderAutomatedOptions[key],
      type: builderOptionTypes[key] || 'string',
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

async function runCliParser() {
  try {
    // Look for nx-commands in the main Nx repository
    const nxCommandsPath = join(
      workspaceRoot,
      'packages/nx/src/command-line/nx-commands'
    );

    if (!existsSync(nxCommandsPath + '.ts')) {
      throw new Error(`Cannot find nx-commands at ${nxCommandsPath}`);
    }

    // Import nx-commands using importFresh
    const { commandsObject } = importFresh(nxCommandsPath);

    // Get all commands from yargs
    const nxCommands = getCommands(commandsObject);

    // Commands to exclude from documentation
    const sharedCommands = ['generate', 'exec'];
    const hiddenCommands = ['$0', 'conformance', 'conformance:check'];

    const commands = {};

    // Parse each command
    for (const [name, commandConfig] of Object.entries(nxCommands)) {
      if (sharedCommands.includes(name) || hiddenCommands.includes(name)) {
        continue;
      }

      // Check if command has description
      if (
        !(
          commandConfig.description ||
          commandConfig.describe ||
          commandConfig.desc
        )
      ) {
        continue;
      }

      try {
        const parsedCommand = await parseCommand(name, commandConfig);
        commands[name] = parsedCommand;
      } catch (error) {
        console.warn(`⚠️ Could not parse command ${name}:`, error.message);
      }
    }

    // Send result back to parent process
    process.send({ type: 'result', data: { commands } });
    process.exit(0);
  } catch (error) {
    process.send({ type: 'error', error: error.message });
    process.exit(1);
  }
}

runCliParser();
