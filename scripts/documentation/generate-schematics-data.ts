import * as fs from 'fs-extra';
import * as path from 'path';
import { parseJsonSchemaToOptions } from '@angular/cli/utilities/json-schema';
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
): Promise<Schematic>[] {
  const schematicCollectionFile = path.join(config.root, 'collection.json');
  fs.removeSync(config.schematicOutput);
  const schematicCollection = fs.readJsonSync(schematicCollectionFile)
    .schematics;
  return Object.keys(schematicCollection).map(schematicName => {
    const schematic = {
      name: schematicName,
      ...schematicCollection[schematicName],
      alias: schematicCollection[schematicName].hasOwnProperty('alias')
        ? schematicCollection[schematicName]['alias']
        : null,
      rawSchema: fs.readJsonSync(
        path.join(config.root, schematicCollection[schematicName]['schema'])
      )
    };

    return parseJsonSchemaToOptions(registry, schematic.rawSchema)
      .then(options => ({ ...schematic, options }))
      .catch(error =>
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
  const command = framework === 'angular' ? 'ng' : 'nx';
  let template = dedent`
    # ${schematic.name} ${schematic.hidden ? '[hidden]' : ''}
    ${schematic.description}
  
    ## Usage
    \`\`\`bash
    ${command} generate ${schematic.name} ...
    ${schematic.alias ? `${command} g ${schematic.name} ... # Same` : ''}
    \`\`\`
    \n`;

  if (Array.isArray(schematic.options) && !!schematic.options.length) {
    template += '## Options';

    schematic.options
      .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
      .forEach(
        option =>
          (template += dedent`
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
          Type: \`${option.type}\` \n 
          
          
          ${option.description}
        `)
      );
  }

  return { name: schematic.name, template };
}

Promise.all(
  getPackageConfigurations().map(({ framework, configs }) => {
    return Promise.all(
      configs
        .filter(item => item.hasSchematics)
        .map(config => {
          return Promise.all(generateSchematicList(config, registry))
            .then(schematicList =>
              schematicList.map(s => generateTemplate(framework, s))
            )
            .then(markdownList =>
              markdownList.forEach(template =>
                generateFile(config.schematicOutput, template)
              )
            )
            .then(() => {
              console.log(
                `Documentation from ${config.root} generated to ${
                  config.schematicOutput
                }`
              );
            });
        })
    );
  })
).then(() => {
  console.log('Finished Generating all Documentation');
});

getPackageConfigurations().forEach(({ framework, configs }) => {
  const schematics = configs
    .filter(item => item.hasSchematics)
    .map(item => item.name);
  fs.outputJsonSync(
    path.join(__dirname, '../../docs', framework, 'schematics.json'),
    schematics
  );
});
