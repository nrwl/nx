import {
  createProjectGraphAsync,
  output,
  readNxJson,
  readProjectsConfigurationFromProjectGraph,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import { prompt } from 'enquirer';
import {
  GeneratorInformation,
  getGeneratorInformation,
} from 'nx/src/command-line/generate/generator-utils';
import { findInstalledPlugins } from 'nx/src/utils/plugins/installed-plugins';

interface Schema {
  project?: string;
  skipFormat?: boolean;
  exclude?: string[];
}

export async function convertToInferredGenerator(tree: Tree, options: Schema) {
  const generatorChoices = await getPossibleConvertToInferredGenerators(
    options
  );

  const result = (
    await prompt<{ generatorsToRun: string[] }>({
      type: 'multiselect',
      name: 'generatorsToRun',
      message: 'Which convert-to-inferred generators should be run?',
      choices: Array.from(generatorChoices.keys()),
      initial: getInitialGeneratorChoices(generatorChoices, tree, options),
      validate: (result: string[]) => {
        if (result.length === 0) {
          return 'Please select at least one convert-to-inferred generator to run';
        }
        return true;
      },
    } as any)
  ).generatorsToRun;

  if (result.length === 0) {
    output.error({
      title: 'Please select at least one convert-to-inferred generator to run',
    });
    return;
  }

  for (const generatorName of result) {
    output.log({
      title: `Running ${generatorName}`,
    });
    try {
      const generator = generatorChoices.get(generatorName);
      if (generator) {
        const generatorFactory = generator.implementationFactory();
        await generatorFactory(tree, {
          project: options.project,
          skipFormat: options.skipFormat,
        });
      }
    } catch (e) {
      const collection =
        generatorChoices.get(generatorName)?.resolvedCollectionName;
      output.error({
        title: `Failed to run ${generatorName}`,
        bodyLines: [
          e,
          `To rerun this generator without the ${generatorName} generator, use nx g @nx/workspace:convert-to-inferred ${
            options.project ? `--project=${options.project}` : ''
          } --exclude=${
            options.exclude
              ? [...options.exclude, collection].join(', ')
              : collection
          }`,
        ],
      });
      return;
    }
  }
}

async function getPossibleConvertToInferredGenerators(options: Schema) {
  const installedCollections = Array.from(
    new Set(findInstalledPlugins().map((x) => x.name))
  );

  const projectGraph = await createProjectGraphAsync();
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);

  const choices = new Map<string, GeneratorInformation>();

  for (const collectionName of installedCollections) {
    try {
      const generator = getGeneratorInformation(
        collectionName,
        'convert-to-inferred',
        workspaceRoot,
        projectsConfigurations.projects
      );
      if (
        generator.generatorConfiguration.hidden ||
        generator.generatorConfiguration['x-deprecated'] ||
        options.exclude?.includes(generator.resolvedCollectionName)
      ) {
        continue;
      }
      const generatorName = `${generator.resolvedCollectionName}:${generator.normalizedGeneratorName}`;
      if (generatorName === '@nx/workspace:convert-to-inferred') {
        continue;
      }
      choices.set(generatorName, generator);
    } catch {
      // this just means that no convert-to-inferred generator exists for a given collection, ignore
    }
  }

  return choices;
}

function getInitialGeneratorChoices(
  choices: Map<string, GeneratorInformation>,
  tree: Tree,
  options: Schema
) {
  // if a project is specified, we assume the user wants fine-grained contorl over which generators to run
  // in this case we won't include any generators by default
  if (options.project) {
    return [];
  }
  // we want to exclude generators from the default if they already have a plugin registered in nx.json
  // in that case, they're probably already using inferred targets
  const nxJson = readNxJson(tree);

  const collectionsWithRegisteredPlugins: Set<string> = new Set();

  for (const plugin of nxJson.plugins ?? []) {
    if (typeof plugin === 'object') {
      collectionsWithRegisteredPlugins.add(
        plugin.plugin.replace('/plugin', '')
      );
    }
  }

  const initialChoices = new Set();
  for (const [generatorName, generator] of choices) {
    if (
      !collectionsWithRegisteredPlugins.has(generator.resolvedCollectionName)
    ) {
      initialChoices.add(generatorName);
    }
  }

  return Array.from(initialChoices);
}

export default convertToInferredGenerator;
