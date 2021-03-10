import * as fs from 'fs-extra';
import * as path from 'path';
import { parseJsonSchemaToOptions } from './json-parser';
import { dedent } from 'tslint/lib/utils';
import { FileSystemSchematicJsonDescription } from '@angular-devkit/schematics/tools';
import { CoreSchemaRegistry } from '@angular-devkit/core/src/json/schema';
import {
  htmlSelectorFormat,
  pathFormat,
} from '@angular-devkit/schematics/src/formats';
import {
  generateJsonFile,
  generateMarkdownFile,
  sortAlphabeticallyFunction,
} from './utils';
import {
  Configuration,
  getPackageConfigurations,
} from './get-package-configurations';

/**
 * @WhatItDoes: Generates default documentation from the builders' schema.
 *    We need to construct an Array of objects containing all the information
 *    of the builders and their associates schema info. It should be easily
 *    parsable in order to be used in a rendering process using template. This
 *    in order to generate a markdown file for each available schematic.
 */
const registry = new CoreSchemaRegistry();
registry.addFormat(pathFormat);
registry.addFormat(htmlSelectorFormat);

function readExecutorsJson(root: string) {
  try {
    return fs.readJsonSync(path.join(root, 'builders.json')).builders;
  } catch (e) {
    return fs.readJsonSync(path.join(root, 'executors.json')).executors;
  }
}

function generateSchematicList(
  config: Configuration,
  registry: CoreSchemaRegistry
): Promise<FileSystemSchematicJsonDescription>[] {
  fs.removeSync(config.builderOutput);
  const builderCollection = readExecutorsJson(config.root);
  return Object.keys(builderCollection).map((builderName) => {
    const schemaPath = path.join(
      config.root,
      builderCollection[builderName]['schema']
    );
    let builder = {
      name: builderName,
      ...builderCollection[builderName],
      rawSchema: fs.readJsonSync(schemaPath),
    };
    if (builder.rawSchema.examplesFile) {
      builder.examplesFileFullPath = path.join(
        schemaPath.replace('schema.json', ''),
        builder.rawSchema.examplesFile
      );
    }
    return parseJsonSchemaToOptions(registry, builder.rawSchema)
      .then((options) => ({ ...builder, options }))
      .catch((error) =>
        console.error(`Can't parse schema option of ${builder.name}:\n${error}`)
      );
  });
}

function generateTemplate(
  framework,
  builder
): { name: string; template: string } {
  const filename = framework === 'angular' ? 'angular.json' : 'workspace.json';
  const cliCommand = 'nx';

  let template = dedent`
    # ${builder.name}
    ${builder.description}

    Properties can be configured in ${filename} when defining the executor, or when invoking it.
    ${
      framework != 'angular'
        ? `Read more about how to use executors and the CLI here: https://nx.dev/${framework}/getting-started/cli-overview#running-tasks.`
        : ``
    }
    \n`;

  if (builder.examplesFileFullPath) {
    template += `## Examples\n`;
    let examples = fs
      .readFileSync(builder.examplesFileFullPath)
      .toString()
      .replace(/<%= cli %>/gm, cliCommand);
    template += dedent`${examples}`;
  }

  if (Array.isArray(builder.options) && !!builder.options.length) {
    template += '## Properties';

    builder.options
      .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
      .forEach((option) => {
        const enumStr = option.enum
          ? `Possible values: ${option.enum
              .map((e) => `\`${e}\``)
              .join(', ')}\n`
          : ``;
        template += dedent`
            ### ${option.name} ${option.required ? '(*__required__*)' : ''} ${
          option.hidden ? '(__hidden__)' : ''
        }
            
            ${
              !!option.aliases.length
                ? `Alias(es): ${option.aliases.join(',')}\n`
                : ''
            }
            ${
              option.default === undefined || option.default === ''
                ? ''
                : `Default: \`${option.default}\`\n`
            }`;

        if (option.types && option.types.length) {
          const displayTypeList = option.types.map((type) =>
            type === 'array' ? `${option.type}[]` : type
          );
          template += dedent`
              Type: \`${displayTypeList.join(' | ')} \`\n`;
        } else {
          template += dedent`
              Type: ${
                option.arrayOfType
                  ? `\`${option.arrayOfType}[]\``
                  : `\`${option.type}\``
              } \n`;
        }

        template += dedent`  
            ${enumStr} 
            ${option.description}
          `;

        if (option.arrayOfType && option.arrayOfValues) {
          option.arrayOfValues.forEach((optionValue) => {
            template += dedent`
              #### ${optionValue.name} ${
              optionValue.required ? '(*__required__*)' : ''
            }
              Type: \`${optionValue.type}\` \n 
              ${optionValue.description}
            `;
          });
        }
      });
  }

  return { name: builder.name, template };
}

Promise.all(
  getPackageConfigurations().map(({ framework, configs }) => {
    return Promise.all(
      configs
        .filter((item) => item.hasBuilders)
        .map((config) => {
          Promise.all(generateSchematicList(config, registry))
            .then((builderList) =>
              builderList.map((b) => generateTemplate(framework, b))
            )
            .then((markdownList) =>
              Promise.all(
                markdownList.map((template) =>
                  generateMarkdownFile(config.builderOutput, template)
                )
              )
            )
            .then(() =>
              console.log(
                `Generated documentation for ${config.root} to ${config.output}`
              )
            );
        })
    );
  })
).then(() => {
  console.log('Done generating documentation for executors');
});

getPackageConfigurations().forEach(async ({ framework, configs }) => {
  const builders = configs
    .filter((item) => item.hasBuilders)
    .map((item) => item.name);
  await generateJsonFile(
    path.join(__dirname, '../../docs', framework, 'executors.json'),
    builders
  );
});
