import * as fs from 'fs-extra';
import * as path from 'path';
import { dedent } from 'tslint/lib/utils';
import { commandsObject } from '../../packages/workspace';
import { generateMarkdownFile, sortAlphabeticallyFunction } from './utils';

const importFresh = require('import-fresh');

const examples = {
  'print-affected': [
    {
      command: 'print-affected',
      description:
        'Print information about affected projects and the dependency graph.',
    },
    {
      command: 'print-affected --base=master --head=HEAD',
      description:
        'Print information about the projects affected by the changes between master and HEAD (e.g,. PR).',
    },
    {
      command: 'print-affected --target=test',
      description:
        'Prints information about the affected projects and a list of tasks to test them.',
    },
    {
      command: 'print-affected --target=build --with-deps',
      description:
        'Prints information about the affected projects and a list of tasks to build them and their dependencies.',
    },
    {
      command: 'print-affected --target=build --select=projects',
      description:
        'Prints the projects property from the print-affected output.',
    },
    {
      command: 'print-affected --target=build --select=tasks.target.project',
      description:
        'Prints the tasks.target.project property from the print-affected output.',
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
      command: 'affected --target=test --with-deps',
      description:
        'Run the test target for the affected projects and also all the projects the affected projects depend on.',
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
    {
      command:
        'affected --target=build --base=master~1 --head=master --with-deps',
      description:
        'Run build for all the projects affected by the last commit on master and their dependencies',
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
      command: 'affected:build --with-deps',
      description:
        'Run the build target for the affected projects and also all the projects the affected projects depend on.',
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
    {
      command: 'affected:build --base=master~1 --head=master --with-deps',
      description:
        'Run build for all the projects affected by the last commit on master and their dependencies',
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
  'workspace-schematic': [],
  list: [
    {
      command: 'list',
      description: 'List the plugins installed in the current workspace',
    },
    {
      command: 'list @nrwl/web',
      description:
        'List the schematics and builders available in the `@nrwl/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace)',
    },
  ],
  'run-many': [
    {
      command: 'run-many --target=test --all',
      description: 'Test all projects.',
    },
    {
      command: 'run-many --target=test --projects=proj1,proj2',
      description: 'Test proj1 and proj2.',
    },
    {
      command:
        'run-many --target=test --projects=proj1,proj2 --parallel --maxParallel=2',
      description: 'Test proj1 and proj2 in parallel.',
    },
    {
      command: 'run-many --target=test --projects=proj1,proj2 --with-deps',
      description: 'Build proj1 and proj2 and all their dependencies.',
    },
  ],
  migrate: [
    {
      command: 'migrate next',
      description:
        'Update @nrwl/workspace to "next". This will update other packages and will generate migrations.json.',
    },
    {
      command: 'migrate 9.0.0',
      description:
        'Update @nrwl/workspace to "9.0.0". This will update other packages and will generate migrations.json.',
    },
    {
      command:
        'migrate @nrwl/workspace@9.0.0 --from="@nrwl/workspace@8.0.0,@nrwl/node@8.0.0"',
      description:
        'Update @nrwl/workspace and generate the list of migrations starting with version 8.0.0 of @nrwl/workspace and @nrwl/node, regardless of what installed locally.',
    },
    {
      command:
        'migrate @nrwl/workspace@9.0.0 --to="@nrwl/react@9.0.1,@nrwl/angular@9.0.1"',
      description:
        'Update @nrwl/workspace to "9.0.0". If it tries to update @nrwl/react or @nrwl/angular, use version "9.0.1".',
    },
    {
      command: 'migrate another-package@12.0.0',
      description:
        'Update another-package to "12.0.0". This will update other packages and will generate migrations.json file.',
    },
    {
      command: 'migrate --run-migrations=migrations.json',
      description:
        'Run migrations from the migrations.json file. You can modify migrations.json and run this command many times.',
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

console.log('Generating Nx Commands Documentation');
Promise.all(
  ['angular', 'react'].map(async (framework) => {
    const commandsOutputDirectory = path.join(
      __dirname,
      '../../docs/',
      framework,
      'cli'
    );
    fs.removeSync(commandsOutputDirectory);
    function getCommands(command) {
      return command.getCommandInstance().getCommandHandlers();
    }
    function parseCommandInstance(name, command) {
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
          command: name,
          description: command['description'],
        };
      }
      // Show all the options we can get from yargs
      const builder = command.builder(importFresh('yargs')().resetOptions());
      const builderDescriptions = builder.getUsageInstance().getDescriptions();
      const builderDefaultOptions = builder.getOptions().default;
      return {
        command: name,
        description: command['description'],
        options:
          Object.keys(builderDescriptions).map((key) => ({
            command: '--'.concat(key),
            description: builderDescriptions[key]
              ? builderDescriptions[key].replace('__yargsString__:', '')
              : '',
            default: builderDefaultOptions[key],
          })) || null,
      };
    }
    function generateMarkdown(command) {
      let template = dedent`
      # ${command.command}
      ${command.description}

      ## Usage
      \`\`\`bash
      nx ${command.command}
      \`\`\`

      Install \`nx\` globally to invoke the command directly using \`nx\`, or use \`npm run nx\` or \`yarn nx\`.\n`;

      if (examples[command.command] && examples[command.command].length > 0) {
        template += `### Examples`;
        examples[command.command].forEach((example) => {
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
          .sort((a, b) =>
            sortAlphabeticallyFunction(
              a.command.replace('--', ''),
              b.command.replace('--', '')
            )
          )
          .forEach(
            (option) =>
              (template += dedent`
            ### ${option.command.replace('--', '')}
            ${
              option.default === undefined || option.default === ''
                ? ''
                : `Default: \`${option.default}\`\n`
            }
            ${option.description}
          `)
          );
      }

      return {
        name: command.command
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
        .map((command) => generateMarkdown(command))
        .map((templateObject) =>
          generateMarkdownFile(commandsOutputDirectory, templateObject)
        )
    );

    await Promise.all(
      sharedCommands.map((command) => {
        const sharedCommandsDirectory = path.join(
          __dirname,
          '../../docs/shared/cli'
        );
        const sharedCommandsOutputDirectory = path.join(
          __dirname,
          '../../docs/',
          framework,
          'cli'
        );
        const templateObject = {
          name: command,
          template: fs
            .readFileSync(path.join(sharedCommandsDirectory, `${command}.md`))
            .toString('utf-8'),
        };

        return generateMarkdownFile(
          sharedCommandsOutputDirectory,
          templateObject
        );
      })
    );
  })
).then(() => {
  console.log('Finished generating Nx Commands Documentation');
});
