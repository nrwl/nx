import { parseJsonSchemaToOptions } from '@angular/cli/utilities/json-schema';
import { dedent } from 'tslint/lib/utils';
import { Schematic } from '@angular-devkit/schematics/collection-schema';
import { CoreSchemaRegistry } from '@angular-devkit/core/src/json/schema';
import {
  htmlSelectorFormat,
  pathFormat
} from '@angular-devkit/schematics/src/formats';
import { sortAlphabeticallyFunction } from './utils';

const fs = require('fs-extra');
const path = require('path');

/**
 * @WhatItDoes: Generates default documentation from the schematics' schema.
 *    We need to construct an Array of objects containing all the information
 *    of the schematics and their associates schema info. It should be easily
 *    parsable in order to be used in a rendering process using template. This
 *    in order to generate a markdown file for each available schematic.
 */
const schematicsConfig = {
  source: path.join(__dirname, '../../packages/schematics/src'),
  output: path.join(__dirname, '../../docs/api-schematics')
};
const reactConfig = {
  source: path.join(__dirname, '../../packages/react'),
  output: path.join(__dirname, '../../docs/api-react')
};
const jestConfig = {
  source: path.join(__dirname, '../../packages/jest'),
  output: path.join(__dirname, '../../docs/api-jest/schematics')
};
interface DocConfig {
  source: string;
  output: string;
}
const docSections: DocConfig[] = [schematicsConfig, reactConfig, jestConfig];
const registry = new CoreSchemaRegistry();
registry.addFormat(pathFormat);
registry.addFormat(htmlSelectorFormat);

function generateSchematicList(
  config: DocConfig,
  registry: CoreSchemaRegistry
): Promise<Schematic>[] {
  const schematicCollectionFile = path.join(config.source, 'collection.json');
  fs.removeSync(config.output);
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
        path.join(config.source, schematicCollection[schematicName]['schema'])
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

function generateFile(
  outputDirectory: string,
  templateObject: { name: string; template: string }
): void {
  fs.outputFileSync(
    path.join(outputDirectory, `${templateObject.name}.md`),
    templateObject.template
  );
}

Promise.all(
  docSections.map(config => {
    return Promise.all(generateSchematicList(config, registry))
      .then(schematicList => schematicList.map(generateTemplate))
      .then(markdownList =>
        markdownList.forEach(template => generateFile(config.output, template))
      )
      .then(() => {
        console.log(
          `Documentation from ${config.source} generated to ${config.output}`
        );
      });
  })
).then(() => {
  console.log('Finished Generating all Documentation');
});
