import { parseJsonSchemaToOptions } from '@angular/cli/utilities/json-schema';
import { dedent } from 'tslint/lib/utils';
import { Schematic } from '@angular-devkit/schematics/collection-schema';
import { CoreSchemaRegistry } from '@angular-devkit/core/src/json/schema';
import {
  htmlSelectorFormat,
  pathFormat
} from '@angular-devkit/schematics/src/formats';

const fs = require('fs-extra');
const path = require('path');

/**
 * @WhatItDoes: Generates default documentation from the schematics' schema.
 *    We need to construct an Array of objects containing all the information
 *    of the schematics and their associates schema info. It should be easily
 *    parsable in order to be used in a rendering process using template. This
 *    in order to generate a markdown file for each available schematic.
 */
const schematicsSourceDirectory = path.join(
  __dirname,
  '../../packages/schematics/src'
);
const schematicsOutputDirectory = path.join(
  __dirname,
  '../../docs/api-schematics'
);
const schematicCollectionFile = path.join(
  schematicsSourceDirectory,
  'collection.json'
);
fs.removeSync(schematicsOutputDirectory);
const schematicCollection = fs.readJsonSync(schematicCollectionFile).schematics;
const registry = new CoreSchemaRegistry();
registry.addFormat(pathFormat);
registry.addFormat(htmlSelectorFormat);

function generateSchematicList(
  schematicCollection: Schematic,
  registry: CoreSchemaRegistry
): Promise<Schematic>[] {
  return Object.keys(schematicCollection).map(schematicName => {
    const schematic = {
      name: schematicName,
      ...schematicCollection[schematicName],
      alias: schematicCollection[schematicName].hasOwnProperty('alias')
        ? schematicCollection[schematicName]['alias']
        : null,
      rawSchema: fs.readJsonSync(
        path.join(
          schematicsSourceDirectory,
          schematicCollection[schematicName]['schema']
        )
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

function generateTemplate(schematic): { name: string; template: string } {
  let template = dedent`
    # ${schematic.name} ${schematic.hidden ? '[hidden]' : ''}
    ${schematic.description}
  
    ## Usage
    \`\`\`bash
    ng generate ${schematic.name} ...
    ${schematic.alias ? `ng g ${schematic.name} ... # Same` : ''}
    \`\`\`
    \n`;

  if (Array.isArray(schematic.options) && !!schematic.options.length) {
    template += '## Options';

    schematic.options.forEach(
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

function generateFile(
  outputDirectory: string,
  templateObject: { name: string; template: string }
): void {
  fs.outputFileSync(
    path.join(outputDirectory, `${templateObject.name}.md`),
    templateObject.template
  );
}

Promise.all(generateSchematicList(schematicCollection, registry))
  .then(schematicList => schematicList.map(generateTemplate))
  .then(markdownList =>
    markdownList.forEach(template =>
      generateFile(schematicsOutputDirectory, template)
    )
  );
