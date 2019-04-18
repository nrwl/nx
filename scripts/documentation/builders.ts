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
import { sortAlphabeticallyFunction } from './utils';

/**
 * @WhatItDoes: Generates default documentation from the builders' schema.
 *    We need to construct an Array of objects containing all the information
 *    of the builders and their associates schema info. It should be easily
 *    parsable in order to be used in a rendering process using template. This
 *    in order to generate a markdown file for each available schematic.
 */
interface DocConfig {
  source: string;
  output: string;
}
const buildersConfig = {
  source: path.join(__dirname, '../../packages/builders/src'),
  output: path.join(__dirname, '../../docs/api-builders')
};
const jestConfig = {
  source: path.join(__dirname, '../../packages/jest'),
  output: path.join(__dirname, '../../docs/api-jest/builders')
};
const docConfigs: DocConfig[] = [buildersConfig, jestConfig];
const registry = new CoreSchemaRegistry();
registry.addFormat(pathFormat);
registry.addFormat(htmlSelectorFormat);

function generateSchematicList(
  config: DocConfig,
  registry: CoreSchemaRegistry
): Promise<Schematic>[] {
  const builderCollectionFile = path.join(config.source, 'builders.json');
  fs.removeSync(config.output);
  const builderCollection = fs.readJsonSync(builderCollectionFile).builders;
  return Object.keys(builderCollection).map(builderName => {
    const builder = {
      name: builderName,
      ...builderCollection[builderName],
      rawSchema: fs.readJsonSync(
        path.join(config.source, builderCollection[builderName]['schema'])
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
  docConfigs.map(config => {
    Promise.all(generateSchematicList(config, registry))
      .then(builderList => builderList.map(generateTemplate))
      .then(markdownList =>
        markdownList.forEach(template => generateFile(config.output, template))
      )
      .then(() =>
        console.log(
          `Generated documentation for ${config.source} to ${config.output}`
        )
      );
  })
).then(() => {
  console.log('Done generating Builders Documentation');
});
