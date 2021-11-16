import { removeSync, readJsonSync } from 'fs-extra';
import * as chalk from 'chalk';
import * as path from 'path';
import { dedent } from 'tslint/lib/utils';
import { FileSystemSchematicJsonDescription } from '@angular-devkit/schematics/tools';
import {
  htmlSelectorFormat,
  pathFormat,
} from '@angular-devkit/schematics/src/formats';
import {
  formatDeprecated,
  generateJsonFile,
  generateMarkdownFile,
  sortAlphabeticallyFunction,
  sortByBooleanFunction,
} from './utils';
import {
  Configuration,
  getPackageConfigurations,
} from './get-package-configurations';
import { Framework } from './frameworks';
import { parseJsonSchemaToOptions } from './json-parser';
import { createSchemaFlattener, SchemaFlattener } from './schema-flattener';

/**
 * @WhatItDoes: Generates default documentation from the schematics' schema.
 *    We need to construct an Array of objects containing all the information
 *    of the schematics and their associated schema info. It should be easily
 *    parsable in order to be used in a rendering process using template. This
 *    in order to generate a markdown file for each available schematic.
 */
const flattener = createSchemaFlattener([pathFormat, htmlSelectorFormat]);

function generateSchematicList(
  config: Configuration,
  flattener: SchemaFlattener
): Promise<FileSystemSchematicJsonDescription>[] {
  const schematicCollectionFilePath = path.join(config.root, 'generators.json');
  const schematicCollectionFile = readJsonSync(schematicCollectionFilePath);
  removeSync(config.schematicOutput);
  const schematicCollection =
    schematicCollectionFile.schematics || schematicCollectionFile.generators;
  return Object.keys(schematicCollection).map((schematicName) => {
    const schematic = {
      name: schematicName,
      collectionName: `@nrwl/${config.name}`,
      ...schematicCollection[schematicName],
      alias: schematicCollection[schematicName].hasOwnProperty('aliases')
        ? schematicCollection[schematicName]['aliases'][0]
        : null,
      rawSchema: readJsonSync(
        path.join(config.root, schematicCollection[schematicName]['schema'])
      ),
    };

    return parseJsonSchemaToOptions(flattener, schematic.rawSchema)
      .then((options) => ({ ...schematic, options }))
      .catch((error) =>
        console.error(
          `Can't parse schema option of ${schematic.name} | ${schematic.collectionName}:\n${error}`
        )
      );
  });
}

function generateTemplate(
  framework: Framework,
  schematic
): { name: string; template: string } {
  const cliCommand = 'nx';
  const filename = framework === 'angular' ? 'angular.json' : 'workspace.json';
  let template = dedent`
    # ${schematic.collectionName}:${schematic.name} ${
    schematic.hidden ? '[hidden]' : ''
  }
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
      .sort((a, b) => sortByBooleanFunction(a.required, b.required))
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
          ### ${option.deprecated ? `~~${option.name}~~` : option.name} ${
          option.required ? '(*__required__*)' : ''
        } ${option.hidden ? '(__hidden__)' : ''}
          
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
        `;

        template += dedent`  
            ${enumStr}

            ${formatDeprecated(option.description, option.deprecated)}
          `;
      });
  }

  return { name: schematic.name, template };
}

export async function generateGeneratorsDocumentation() {
  console.log(`\n${chalk.blue('i')} Generating Documentation for Generators\n`);

  await Promise.all(
    getPackageConfigurations().map(({ framework, configs }) => {
      return Promise.all(
        configs
          .filter((item) => item.hasSchematics)
          .map(async (config) => {
            const schematicList = await Promise.all(
              generateSchematicList(config, flattener)
            );

            const markdownList = schematicList
              .filter((s) => s != null && !s['hidden'])
              .map((s_1) => generateTemplate(framework, s_1));

            await Promise.all(
              markdownList.map((template) =>
                generateMarkdownFile(config.schematicOutput, template)
              )
            );

            console.log(
              ` - ${chalk.blue(
                config.framework
              )} Documentation for ${chalk.magenta(
                path.relative(process.cwd(), config.root)
              )} generated at ${chalk.grey(
                path.relative(process.cwd(), config.schematicOutput)
              )}`
            );
          })
      );
    })
  );

  console.log();
  await Promise.all(
    getPackageConfigurations().map(({ framework, configs }) => {
      const schematics = configs
        .filter((item) => item.hasSchematics)
        .map((item) => item.name);
      return generateJsonFile(
        path.join(__dirname, '../../docs', framework, 'generators.json'),
        schematics
      ).then(() => {
        console.log(
          `${chalk.green('✓')} Generated ${chalk.blue(
            framework
          )} generators.json at ${chalk.grey(
            `docs/${framework}/generators.json`
          )}`
        );
      });
    })
  );

  console.log(`\n${chalk.green('✓')} Generated Documentation for Generators`);
}
