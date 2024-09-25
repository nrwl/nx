import * as chalk from 'chalk';
import { h2, table } from 'markdown-factory';
import {
  generateMarkdownFile,
  generateOptionsMarkdown,
  getCommands,
  parseCommand,
  ParsedCommand,
  sortAlphabeticallyFunction,
} from '../utils';

const importFresh = require('import-fresh');

export async function generateCnwDocumentation(
  commandsOutputDirectory: string
) {
  process.env.NX_GENERATE_DOCS_PROCESS = 'true';

  console.log(
    `\n${chalk.blue(
      'i'
    )} Generating Documentation for Create Nx Workspace Command`
  );

  const { commandsObject } = importFresh(
    '../../../packages/create-nx-workspace/bin/create-nx-workspace'
  );

  const command = getCommands(commandsObject)['$0'];
  const parsedCommand = await parseCommand('create-nx-workspace', command);
  const markdown = generateMarkdown(parsedCommand);
  generateMarkdownFile(commandsOutputDirectory, markdown);

  delete process.env.NX_GENERATE_DOCS_PROCESS;

  console.log(
    `${chalk.green(
      '✓'
    )} Generated Documentation for Create Nx Workspace Command`
  );
}

function generateMarkdown(command: ParsedCommand) {
  let template = `
---
title: "${command.name} - CLI command"
description: "${command.description}"
---
# ${command.name}

${command.description}

## Usage

\`\`\`bash
${command.commandString}
\`\`\`

Install \`create-nx-workspace\` globally to invoke the command directly, or use \`npx create-nx-workspace\`, \`yarn create nx-workspace\`, or \`pnpx create-nx-workspace\`.\n
  `;

  template += generateOptionsMarkdown(command);
  template += '\n\n' + generatePresetsMarkdown();

  return {
    name: command.name,
    template,
  };
}

function generatePresetsMarkdown(): string {
  const { Preset } = importFresh(
    '../../../packages/create-nx-workspace/src/utils/preset/preset'
  );

  const presets = (Object.values(Preset) as string[]).sort(
    sortAlphabeticallyFunction
  );
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
    [Preset.RemixMonorepo]: 'A Remix monorepo',
    [Preset.RemixStandalone]: 'A single Remix application',
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

  type FieldName = 'name' | 'description';
  const items: Record<FieldName, string>[] = presets.map((preset) => ({
    name: preset,
    description: presetDescriptions[preset],
  }));
  const fields: { field: FieldName; label: string }[] = [
    { field: 'name', label: 'Preset' },
    { field: 'description', label: 'Description' },
  ];

  return h2('Presets', table(items, fields));
}
