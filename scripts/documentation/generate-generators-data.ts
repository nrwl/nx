import * as fs from 'fs-extra';
import * as path from 'path';
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
import { parseJsonSchemaToOptions } from './json-parser';

/**
 * @WhatItDoes: Generates default documentation from the schematics' schema.
 *    We need to construct an Array of objects containing all the information
 *    of the schematics and their associates schema info. It should be easily
 *    parsable in order to be used in a rendering process using template. This
 *    in order to generate a markdown file for each available schematic.
 */
const registry = new CoreSchemaRegistry();
registry.addFormat(pathFormat);
registry.addFormat(htmlSelectorFormat);

function generateSchematicList(
  config: Configuration,
  registry: CoreSchemaRegistry
): Promise<FileSystemSchematicJsonDescription>[] {
  const schematicCollectionFile = path.join(config.root, 'collection.json');
  fs.removeSync(config.schematicOutput);
  const schematicCollection = fs.readJsonSync(schematicCollectionFile)
    .schematics;
  return Object.keys(schematicCollection).map((schematicName) => {
    const schematic = {
      name: schematicName,
      collectionName: `@nrwl/${config.name}`,
      ...schematicCollection[schematicName],
      alias: schematicCollection[schematicName].hasOwnProperty('aliases')
        ? schematicCollection[schematicName]['aliases'][0]
        : null,
      rawSchema: fs.readJsonSync(
        path.join(config.root, schematicCollection[schematicName]['schema'])
      ),
    };

    return parseJsonSchemaToOptions(registry, schematic.rawSchema)
      .then((options) => ({ ...schematic, options }))
      .catch((error) =>
        console.error(
          `Can't parse schema option of ${schematic.name}:\n${error}`
        )
      );
  });
}

function generateTemplate(
  framework: string,
  schematic
): { name: string; template: string } {
  const cliCommand = 'nx';
  const filename = framework === 'angular' ? 'angular.json' : 'workspace.json';
  let template = dedent`
    # ${schematic.name} ${schematic.hidden ? '[hidden]' : ''}
    ${schematic.description}
  
    ## Usage
    \`\`\`bash
    ${cliCommand} generate ${schematic.name} ...
    \`\`\`
    `;

  if (schematic.alias) {
    template += dedent`
    \`\`\`bash
    ${cliCommand} g ${schematic.alias} ... # same
    \`\`\`
    `;
  }

  template += dedent`
  By default, Nx will search for \`${schematic.name}\` in the default collection provisioned in \`${filename}\`.\n
  You can specify the collection explicitly as follows:  
  \`\`\`bash
  ${cliCommand} g ${schematic.collectionName}:${schematic.name} ...
  \`\`\`
  `;

  template += dedent`
    Show what will be generated without writing to disk:
    \`\`\`bash
    ${cliCommand} g ${schematic.name} ... --dry-run
    \`\`\`\n
    `;

  if (schematic.rawSchema.examples) {
    template += `### Examples`;
    schematic.rawSchema.examples.forEach((example) => {
      template += dedent`
      ${example.description}:
      \`\`\`bash
      ${cliCommand} ${example.command}
      \`\`\`
      `;
    });
  }

  if (Array.isArray(schematic.options) && !!schematic.options.length) {
    template += '## Options';

    schematic.options
      .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
      .forEach((option) => {
        let enumValues = [];
        const rawSchemaProp = schematic.rawSchema.properties[option.name];
        if (
          rawSchemaProp &&
          rawSchemaProp['x-prompt'] &&
          rawSchemaProp['x-prompt'].items
        ) {
          rawSchemaProp['x-prompt'].items.forEach((p) => {
            enumValues.push(`\`${p.value}\``);
          });
        } else if (option.enum) {
          enumValues = option.enum.map((e) => `\`${e}\``);
        }

        const enumStr =
          enumValues.length > 0
            ? `Possible values: ${enumValues.join(', ')}`
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
          }
          Type: \`${option.type}\`

          ${enumStr}
          
          ${option.description}
        `;
      });
  }

  return { name: schematic.name, template };
}

Promise.all(
  getPackageConfigurations().map(({ framework, configs }) => {
    return Promise.all(
      configs
        .filter((item) => item.hasSchematics)
        .map((config) => {
          return Promise.all(generateSchematicList(config, registry))
            .then((schematicList) => {
              return schematicList
                .filter((s) => !s['hidden'])
                .map((s) => generateTemplate(framework, s));
            })
            .then((markdownList) =>
              Promise.all(
                markdownList.map((template) =>
                  generateMarkdownFile(config.schematicOutput, template)
                )
              )
            )
            .then(() => {
              console.log(
                `Documentation from ${config.root} generated to ${config.schematicOutput}`
              );
            });
        })
    );
  })
).then(() => {
  console.log('Finished Generating Documentation for Generators');
});

getPackageConfigurations().forEach(async ({ framework, configs }) => {
  const schematics = configs
    .filter((item) => item.hasSchematics)
    .map((item) => item.name);
  await generateJsonFile(
    path.join(__dirname, '../../docs', framework, 'generators.json'),
    schematics
  );
});
