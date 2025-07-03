const { join } = require('path');
const { readFileSync } = require('fs');
const { stripVTControlCharacters } = require('node:util');
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
      (option) => (acc = { ...acc, [option]: type })
    );
    return acc;
  }, {});

  return {
    name,
    description: command.description,
    commandString: command.original.replace('$0', name),
    deprecated: command.deprecated,
    options:
      Object.keys(builderDescriptions).map((key) => ({
        name: [key, ...(builderOptions.alias[key] || [])],
        description: builderDescriptions[key]
          ? stripVTControlCharacters(
              builderDescriptions[key].replace('__yargsString__:', '')
            )
          : '',
        default: builderDefaultOptions[key] ?? builderAutomatedOptions[key],
        type: builderOptionTypes[key],
        choices: builderOptionsChoices[key],
        deprecated: builderDeprecatedOptions[key],
        hidden: builderOptions.hiddenOptions.includes(key),
      })) || null,
  };
}

async function runCnwParser() {
  try {
    // Import create-nx-workspace command
    const { commandsObject } = importFresh(
      join(
        workspaceRoot,
        'packages/create-nx-workspace/bin/create-nx-workspace'
      )
    );

    // Parse the command - get the $0 command which is the default create-nx-workspace command
    const commands = getCommands(commandsObject);
    const parsedCommand = await parseCommand(
      'create-nx-workspace',
      commands['$0']
    );

    // Import Preset enum to get all preset values
    const { Preset } = importFresh(
      join(
        workspaceRoot,
        'packages/create-nx-workspace/src/utils/preset/preset'
      )
    );

    // Extract preset descriptions from the original source
    const presetDescriptions = {
      [Preset.Apps]:
        'A basic integrated style repository starting with no projects',
      [Preset.NPM]:
        'A repository configured with NPM Workspaces using a package-based style.',
      [Preset.TS]:
        'A basic integrated style repository starting with TypeScript configured but no projects',
      [Preset.WebComponents]:
        'An integrated style repository with an application configured to use web components',
      [Preset.AngularMonorepo]: 'An Angular monorepo',
      [Preset.AngularStandalone]: 'A single Angular application',
      [Preset.ReactMonorepo]: 'A React monorepo',
      [Preset.ReactStandalone]: 'A single React application',
      [Preset.VueMonorepo]: 'A Vue monorepo',
      [Preset.VueStandalone]: 'A single Vue application',
      [Preset.Nuxt]: 'A Nuxt monorepo',
      [Preset.NuxtStandalone]: 'A single Nuxt application',
      [Preset.NextJs]: 'A Next monorepo',
      [Preset.NextJsStandalone]: 'A single Next application',
      [Preset.ReactNative]: 'A monorepo with a React Native application',
      [Preset.Expo]: 'A monorepo with an Expo application',
      [Preset.Nest]: 'A monorepo with a Nest application',
      [Preset.Express]: 'A monorepo with an Express application',
      [Preset.React]:
        'Allows you to choose between the react-standalone or react-monorepo presets',
      [Preset.Vue]:
        'Allows you to choose between the vue-standalone or vue-monorepo presets',
      [Preset.Angular]:
        'Allows you to choose between the angular-standalone or angular-monorepo presets',
      [Preset.NodeStandalone]: 'A single Node application',
      [Preset.NodeMonorepo]: 'A Node monorepo',
      [Preset.TsStandalone]: 'A single TypeScript application',
    };

    // Send result back to parent process
    process.send({
      type: 'result',
      data: {
        command: parsedCommand,
        presets: Object.values(Preset),
        presetDescriptions,
      },
    });
    process.exit(0);
  } catch (error) {
    process.send({ type: 'error', error: error.message });
    process.exit(1);
  }
}

runCnwParser();
