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

/**
 * @WhatItDoes: Generates default documentation from the builders' schema.
 *    We need to construct an Array of objects containing all the information
 *    of the builders and their associates schema info. It should be easily
 *    parsable in order to be used in a rendering process using template. This
 *    in order to generate a markdown file for each available schematic.
 */
const buildersSourceDirectory = path.join(
  __dirname,
  '../../build/packages/builders/src'
);
const buildersOutputDirectory = path.join(__dirname, '../../docs/api-builders');
const builderCollectionFile = path.join(
  buildersSourceDirectory,
  'builders.json'
);
const builderCollection = fs.readJsonSync(builderCollectionFile).builders;
const registry = new CoreSchemaRegistry();
registry.addFormat(pathFormat);
registry.addFormat(htmlSelectorFormat);

function generateSchematicList(
  builderCollection: Schematic,
  registry: CoreSchemaRegistry
): Promise<Schematic>[] {
  return Object.keys(builderCollection).map(builderName => {
    const builder = {
      name: builderName,
      ...builderCollection[builderName],
      rawSchema: fs.readJsonSync(
        path.join(
          buildersSourceDirectory,
          builderCollection[builderName]['schema']
        )
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
    
    ### Properties
    | Name | Description | Type | Default value |
    |------|-------------|------|---------------|\n`;

  builder.options.forEach(
    option =>
      (template += dedent`| \`${option.name}\` ${
        option.required ? '(*__required__*)' : ''
      } ${option.hidden ? '(__hidden__)' : ''} | ${option.description} | ${
        option.type
      } | \`${option.default}\` | \n`)
  );

  return { name: builder.name, template };
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

Promise.all(generateSchematicList(builderCollection, registry))
  .then(builderList => builderList.map(generateTemplate))
  .then(markdownList =>
    markdownList.forEach(template =>
      generateFile(buildersOutputDirectory, template)
    )
  );
