import * as chalk from 'chalk';
import { readFileSync } from 'fs';
import { removeSync } from 'fs-extra';
import { join } from 'path';
import { dedent } from 'tslint/lib/utils';
import { commandsObject } from '../../packages/workspace';
import { Framework, Frameworks } from './frameworks';
import {
  formatDeprecated,
  generateMarkdownFile,
  sortAlphabeticallyFunction,
} from './utils';
const importFresh = require('import-fresh');

interface Example {
  command: string;
  description: string;
}

const examples: Record<string, Example[]> = {
  'print-affected': [
    {
      command: 'print-affected',
      description:
        'Print information about affected projects and the dependency graph',
    },
    {
      command: 'print-affected --base=master --head=HEAD',
      description:
        'Print information about the projects affected by the changes between master and HEAD (e.g,. PR)',
    },
    {
      command: 'print-affected --target=test',
      description:
        'Prints information about the affected projects and a list of tasks to test them',
    },
    {
      command: 'print-affected --target=build --select=projects',
      description:
        'Prints the projects property from the print-affected output',
    },
    {
      command: 'print-affected --target=build --select=tasks.target.project',
      description:
        'Prints the tasks.target.project property from the print-affected output',
    },
  ],
  affected: [
    {
      command: 'affected --target=custom-target',
      description: 'Run custom target for all affected projects',
    },
    {
      command: 'affected --target=test --parallel --maxParallel=5',
      description: 'Run tests in parallel',
    },
    {
      command: 'affected --target=test --only-failed',
      description:
        'Rerun the test target only for the projects that failed last time',
    },
    {
      command: 'affected --target=test --all',
      description: 'Run the test target for all projects',
    },
    {
      command: 'affected --target=test --files=libs/mylib/src/index.ts',
      description:
        'Run tests for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected --target=test --base=master --head=HEAD',
      description:
        'Run tests for all the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected --target=test --base=master~1 --head=master',
      description:
        'Run tests for all the projects affected by the last commit on master',
    },
  ],
  'affected:test': [
    {
      command: 'affected:test --parallel --maxParallel=5',
      description: 'Run tests in parallel',
    },
    {
      command: 'affected:test --only-failed',
      description:
        'Rerun the test target only for the projects that failed last time',
    },
    {
      command: 'affected:test --all',
      description: 'Run the test target for all projects',
    },
    {
      command: 'affected:test --files=libs/mylib/src/index.ts',
      description:
        'Run tests for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:test --base=master --head=HEAD',
      description:
        'Run tests for all the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected:test --base=master~1 --head=master',
      description:
        'Run tests for all the projects affected by the last commit on master',
    },
  ],
  'affected:build': [
    {
      command: 'affected:build --parallel --maxParallel=5',
      description: 'Run build in parallel',
    },
    {
      command: 'affected:build --only-failed',
      description:
        'Rerun the build target only for the projects that failed last time',
    },
    {
      command: 'affected:build --all',
      description: 'Run the build target for all projects',
    },
    {
      command: 'affected:build --files=libs/mylib/src/index.ts',
      description:
        'Run build for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:build --base=master --head=HEAD',
      description:
        'Run build for all the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected:build --base=master~1 --head=master',
      description:
        'Run build for all the projects affected by the last commit on master',
    },
  ],
  'affected:e2e': [
    {
      command: 'affected:e2e --parallel --maxParallel=5',
      description: 'Run tests in parallel',
    },
    {
      command: 'affected:e2e --only-failed',
      description:
        'Rerun the test target only for the projects that failed last time',
    },
    {
      command: 'affected:e2e --all',
      description: 'Run the test target for all projects',
    },
    {
      command: 'affected:e2e --files=libs/mylib/src/index.ts',
      description:
        'Run tests for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:e2e --base=master --head=HEAD',
      description:
        'Run tests for all the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected:e2e --base=master~1 --head=master',
      description:
        'Run tests for all the projects affected by the last commit on master',
    },
  ],
  'affected:lint': [
    {
      command: 'affected:lint --parallel --maxParallel=5',
      description: 'Run lint in parallel',
    },
    {
      command: 'affected:lint --only-failed',
      description:
        'Rerun the lint target only for the projects that failed last time',
    },
    {
      command: 'affected:lint --all',
      description: 'Run the lint target for all projects',
    },
    {
      command: 'affected:lint --files=libs/mylib/src/index.ts',
      description:
        'Run lint for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:lint --base=master --head=HEAD',
      description:
        'Run lint for all the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected:lint --base=master~1 --head=master',
      description:
        'Run lint for all the projects affected by the last commit on master',
    },
  ],
  'affected:apps': [
    {
      command: 'affected:apps --files=libs/mylib/src/index.ts',
      description:
        'Print the names of all the apps affected by changing the index.ts file',
    },
    {
      command: 'affected:apps --base=master --head=HEAD',
      description:
        'Print the names of all the apps affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected:apps --base=master~1 --head=master',
      description:
        'Print the names of all the apps affected by the last commit on master',
    },
  ],
  'affected:libs': [
    {
      command: 'affected:libs --files=libs/mylib/src/index.ts',
      description:
        'Print the names of all the libs affected by changing the index.ts file',
    },
    {
      command: 'affected:libs --base=master --head=HEAD',
      description:
        'Print the names of all the libs affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected:libs --base=master~1 --head=master',
      description:
        'Print the names of all the libs affected by the last commit on master',
    },
  ],
  'format:write': [],
  'format:check': [],
  'dep-graph': [
    {
      command: 'dep-graph',
      description: 'Open the dep graph of the workspace in the browser',
    },
    {
      command: 'dep-graph --file=output.json',
      description: 'Save the dep graph into a json file',
    },
    {
      command: 'dep-graph --file=output.html',
      description:
        'Generate a static website with dep graph into an html file, accompanied by an asset folder called static',
    },
    {
      command: 'dep-graph --focus=todos-feature-main',
      description:
        'Show the graph where every node is either an ancestor or a descendant of todos-feature-main',
    },
    {
      command: 'dep-graph --include=project-one,project-two',
      description: 'Include project-one and project-two in the dep graph',
    },
    {
      command: 'dep-graph --exclude=project-one,project-two',
      description: 'Exclude project-one and project-two from the dep graph',
    },
    {
      command:
        'dep-graph --focus=todos-feature-main --exclude=project-one,project-two',
      description:
        'Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two',
    },
    {
      command: 'dep-graph --watch',
      description: 'Watch for changes to dep graph and update in-browser',
    },
  ],
  'affected:dep-graph': [
    {
      command: 'affected:dep-graph --files=libs/mylib/src/index.ts',
      description:
        'Open the dep graph of the workspace in the browser, and highlight the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:dep-graph --base=master --head=HEAD',
      description:
        'Open the dep graph of the workspace in the browser, and highlight the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command:
        'affected:dep-graph --base=master --head=HEAD --file=output.json',
      description:
        'Save the dep graph of the workspace in a json file, and highlight the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command:
        'affected:dep-graph --base=master --head=HEAD --file=output.html',
      description:
        'Generate a static website with dep graph data in an html file, highlighting the projects affected by the changes between master and HEAD (e.g., PR)',
    },
    {
      command: 'affected:dep-graph --base=master~1 --head=master',
      description:
        'Open the dep graph of the workspace in the browser, and highlight the projects affected by the last commit on master',
    },
    {
      command: 'affected:dep-graph --exclude=project-one,project-two',
      description:
        'Open the dep graph of the workspace in the browser, highlight the projects affected, but exclude project-one and project-two',
    },
  ],
  'workspace-generator': [],
  list: [
    {
      command: 'list',
      description: 'List the plugins installed in the current workspace',
    },
    {
      command: 'list @nrwl/web',
      description:
        'List the generators and executors available in the `@nrwl/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace)',
    },
  ],
  'run-many': [
    {
      command: 'run-many --target=test --all',
      description: 'Test all projects',
    },
    {
      command: 'run-many --target=test --projects=proj1,proj2',
      description: 'Test proj1 and proj2',
    },
    {
      command:
        'run-many --target=test --projects=proj1,proj2 --parallel --maxParallel=2',
      description: 'Test proj1 and proj2 in parallel',
    },
  ],
  migrate: [
    {
      command: 'migrate next',
      description:
        'Update @nrwl/workspace to "next". This will update other packages and will generate migrations.json',
    },
    {
      command: 'migrate 9.0.0',
      description:
        'Update @nrwl/workspace to "9.0.0". This will update other packages and will generate migrations.json',
    },
    {
      command:
        'migrate @nrwl/workspace@9.0.0 --from="@nrwl/workspace@8.0.0,@nrwl/node@8.0.0"',
      description:
        'Update @nrwl/workspace and generate the list of migrations starting with version 8.0.0 of @nrwl/workspace and @nrwl/node, regardless of what installed locally',
    },
    {
      command:
        'migrate @nrwl/workspace@9.0.0 --to="@nrwl/react@9.0.1,@nrwl/angular@9.0.1"',
      description:
        'Update @nrwl/workspace to "9.0.0". If it tries to update @nrwl/react or @nrwl/angular, use version "9.0.1"',
    },
    {
      command: 'migrate another-package@12.0.0',
      description:
        'Update another-package to "12.0.0". This will update other packages and will generate migrations.json file',
    },
    {
      command: 'migrate --run-migrations=migrations.json',
      description:
        'Run migrations from the migrations.json file. You can modify migrations.json and run this command many times',
    },
  ],
};

const sharedCommands = [
  'build',
  'e2e',
  'generate',
  'lint',
  'run',
  'serve',
  'test',
];

interface ParsedCommandOption {
  name: string;
  description: string;
  default: string;
  deprecated: boolean | string;
}

interface ParsedCommand {
  name: string;
  description: string;
  options?: Array<ParsedCommandOption>;
}

export async function generateCLIDocumentation() {
  console.log(`\n${chalk.blue('i')} Generating Documentation for Nx Commands`);

  await Promise.all(
    Frameworks.map(async (framework: Framework) => {
      const commandsOutputDirectory = join(
        __dirname,
        '../../docs/',
        framework,
        'cli'
      );
      removeSync(commandsOutputDirectory);

      function getCommands(command) {
        return command.getCommandInstance().getCommandHandlers();
      }
      async function parseCommandInstance(
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
          return { name, description: command.description };
        }
        // Show all the options we can get from yargs
        const builder = await command.builder(
          importFresh('yargs')().resetOptions()
        );
        const builderDescriptions = builder
          .getUsageInstance()
          .getDescriptions();
        const builderDefaultOptions = builder.getOptions().default;
        const builderDeprecatedOptions = builder.getDeprecatedOptions();
        return {
          name,
          description: command.description,
          options:
            Object.keys(builderDescriptions).map((key) => ({
              name: key,
              description: builderDescriptions[key]
                ? builderDescriptions[key].replace('__yargsString__:', '')
                : '',
              default: builderDefaultOptions[key],
              deprecated: builderDeprecatedOptions[key],
            })) || null,
        };
      }

      function generateMarkdown(command: ParsedCommand) {
        let template = dedent`
# ${command.name}

${command.description}

## Usage

\`\`\`bash
nx ${command.name}
\`\`\`

[Install \`nx\` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using \`nx\`, or use \`npx nx\`, \`yarn nx\`, or \`pnpx nx\`.\n`;

        if (examples[command.name] && examples[command.name].length > 0) {
          template += `\n### Examples`;
          examples[command.name].forEach((example) => {
            template += dedent`
              ${example.description}:
              \`\`\`bash
              nx ${example.command}
              \`\`\`
            `;
          });
        }

        if (Array.isArray(command.options) && !!command.options.length) {
          template += '\n## Options';

          command.options
            .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
            .forEach((option) => {
              template += dedent`
                ### ${option.deprecated ? `~~${option.name}~~` : option.name}
                ${
                  option.default === undefined || option.default === ''
                    ? ''
                    : `Default: \`${option.default}\`\n`
                }
              `;
              template += dedent`
                ${formatDeprecated(option.description, option.deprecated)}
              `;
            });
        }

        return {
          name: command.name
            .replace(':', '-')
            .replace(' ', '-')
            .replace(/[\]\[.]+/gm, ''),
          template,
        };
      }

      // TODO: Try to add option's type, examples, and group?
      const nxCommands = getCommands(commandsObject);
      await Promise.all(
        Object.keys(nxCommands)
          .filter((name) => !sharedCommands.includes(name))
          .map((name) => parseCommandInstance(name, nxCommands[name]))
          .map(async (command) => generateMarkdown(await command))
          .map(async (templateObject) =>
            generateMarkdownFile(commandsOutputDirectory, await templateObject)
          )
      );

      await Promise.all(
        sharedCommands.map((command) => {
          const sharedCommandsDirectory = join(
            __dirname,
            '../../docs/shared/cli'
          );
          const sharedCommandsOutputDirectory = join(
            __dirname,
            '../../docs/',
            framework,
            'cli'
          );
          const templateObject = {
            name: command,
            template: readFileSync(
              join(sharedCommandsDirectory, `${command}.md`),
              'utf-8'
            ),
          };

          return generateMarkdownFile(
            sharedCommandsOutputDirectory,
            templateObject
          );
        })
      );
    })
  );

  console.log(`${chalk.green('✓')} Generated Documentation for Nx Commands`);
}
