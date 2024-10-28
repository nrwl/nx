import { dirname, join } from 'path';
import {
  Generator,
  GeneratorsJson,
  GeneratorsJsonEntry,
} from '../../config/misc-interfaces';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import {
  getImplementationFactory,
  resolveSchema,
} from '../../config/schema-utils';
import { readJsonFile } from '../../utils/fileutils';
import { readPluginPackageJson } from '../../project-graph/plugins';

export type GeneratorInformation = {
  resolvedCollectionName: string;
  normalizedGeneratorName: string;
  schema: any;
  implementationFactory: () => Generator<unknown>;
  isNgCompat: boolean;
  isNxGenerator: boolean;
  generatorConfiguration: GeneratorsJsonEntry;
};

export function getGeneratorInformation(
  collectionName: string,
  generatorName: string,
  root: string | null,
  projects: Record<string, ProjectConfiguration>
): GeneratorInformation {
  try {
    const {
      generatorsFilePath,
      generatorsJson,
      resolvedCollectionName,
      normalizedGeneratorName,
    } = readGeneratorsJson(collectionName, generatorName, root, projects);
    const generatorsDir = dirname(generatorsFilePath);
    const generatorConfig =
      generatorsJson.generators?.[normalizedGeneratorName] ||
      generatorsJson.schematics?.[normalizedGeneratorName];
    const isNgCompat = !generatorsJson.generators?.[normalizedGeneratorName];
    const schemaPath = resolveSchema(generatorConfig.schema, generatorsDir);
    const schema = readJsonFile(schemaPath);
    if (!schema.properties || typeof schema.properties !== 'object') {
      schema.properties = {};
    }
    generatorConfig.implementation =
      generatorConfig.implementation || generatorConfig.factory;
    const implementationFactory = getImplementationFactory<Generator>(
      generatorConfig.implementation,
      generatorsDir
    );
    const normalizedGeneratorConfiguration: GeneratorsJsonEntry = {
      ...generatorConfig,
      aliases: generatorConfig.aliases ?? [],
      hidden: !!generatorConfig.hidden,
    };
    return {
      resolvedCollectionName,
      normalizedGeneratorName,
      schema,
      implementationFactory,
      isNgCompat,
      isNxGenerator: !isNgCompat,
      generatorConfiguration: normalizedGeneratorConfiguration,
    };
  } catch (e) {
    throw new Error(
      `Unable to resolve ${collectionName}:${generatorName}.\n${e.message}`
    );
  }
}

export function readGeneratorsJson(
  collectionName: string,
  generator: string,
  root: string | null,
  projects: Record<string, ProjectConfiguration>
): {
  generatorsFilePath: string;
  generatorsJson: GeneratorsJson;
  normalizedGeneratorName: string;
  resolvedCollectionName: string;
} {
  let generatorsFilePath;
  if (collectionName.endsWith('.json')) {
    generatorsFilePath = require.resolve(collectionName, {
      paths: root ? [root, __dirname] : [__dirname],
    });
  } else {
    const { json: packageJson, path: packageJsonPath } = readPluginPackageJson(
      collectionName,
      projects,
      root ? [root, __dirname] : [__dirname]
    );
    const generatorsFile = packageJson.generators ?? packageJson.schematics;

    if (!generatorsFile) {
      throw new Error(
        `The "${collectionName}" package does not support Nx generators.`
      );
    }

    generatorsFilePath = require.resolve(
      join(dirname(packageJsonPath), generatorsFile)
    );
  }
  const generatorsJson = readJsonFile<GeneratorsJson>(generatorsFilePath);

  let normalizedGeneratorName =
    findFullGeneratorName(generator, generatorsJson.generators) ||
    findFullGeneratorName(generator, generatorsJson.schematics);

  if (!normalizedGeneratorName) {
    for (let parent of generatorsJson.extends || []) {
      try {
        return readGeneratorsJson(parent, generator, root, projects);
      } catch (e) {}
    }

    throw new Error(
      `Cannot find generator '${generator}' in ${generatorsFilePath}.`
    );
  }
  return {
    generatorsFilePath,
    generatorsJson,
    normalizedGeneratorName,
    resolvedCollectionName: collectionName,
  };
}

function findFullGeneratorName(
  name: string,
  generators: {
    [name: string]: { aliases?: string[] };
  }
) {
  if (generators) {
    for (let [key, data] of Object.entries<{ aliases?: string[] }>(
      generators
    )) {
      if (
        key === name ||
        (data.aliases && (data.aliases as string[]).includes(name))
      ) {
        return key;
      }
    }
  }
}
