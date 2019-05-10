import * as fs from 'fs-extra';
import * as path from 'path';
import { parseJsonSchemaToOptions } from './json-parser';
import { dedent } from 'tslint/lib/utils';
import { Schematic } from '@angular-devkit/schematics/collection-schema';
import { CoreSchemaRegistry } from '@angular-devkit/core/src/json/schema';
import {
  htmlSelectorFormat,
  pathFormat
} from '@angular-devkit/schematics/src/formats';
import { generateFile, sortAlphabeticallyFunction } from './utils';
import {
  Configuration,
  getPackageConfigurations
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

function generateSchematicList(
  config: Configuration,
  registry: CoreSchemaRegistry
): Promise<Schematic>[] {
  const builderCollectionFile = path.join(config.root, 'builders.json');
  fs.removeSync(config.builderOutput);
  const builderCollection = fs.readJsonSync(builderCollectionFile).builders;
  return Object.keys(builderCollection).map(builderName => {
    const builder = {
      name: builderName,
      ...builderCollection[builderName],
      rawSchema: fs.readJsonSync(
        path.join(config.root, builderCollection[builderName]['schema'])
      )
    };
    return parseJsonSchemaToOptions(registry, builder.rawSchema)
      .then(options => ({ ...builder, options }))
      .catch(error =>
        console.error(`Can't parse schema option of ${builder.name}:\n${error}`)
      );
  });
}

function generateTemplate(builder): { name: string; template: string } {
  let template = dedent`
    # ${builder.name}
    ${builder.description}
    \n`;

  if (Array.isArray(builder.options) && !!builder.options.length) {
    template += '## Properties';

    builder.options
      .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
      .forEach(option => {
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
            Type: \`${option.type}\` ${
          option.arrayOfType ? `of \`${option.arrayOfType}\`` : ''
        } \n 
            
            
            ${option.description}
          `;

        if (option.arrayOfType && option.arrayOfValues) {
          option.arrayOfValues.forEach(optionValue => {
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
  getPackageConfigurations()
    .filter(item => item.hasBuilders)
    .map(config => {
      Promise.all(generateSchematicList(config, registry))
        .then(builderList => builderList.map(generateTemplate))
        .then(markdownList =>
          markdownList.forEach(template =>
            generateFile(config.builderOutput, template)
          )
        )
        .then(() =>
          console.log(
            `Generated documentation for ${config.root} to ${config.output}`
          )
        );
    })
).then(() => {
  console.log('Done generating Builders Documentation');
});

const builders = getPackageConfigurations()
  .filter(item => item.hasBuilders)
  .map(item => item.name);
fs.outputJsonSync(
  path.join(__dirname, '../../docs', 'builders.json'),
  builders
);
