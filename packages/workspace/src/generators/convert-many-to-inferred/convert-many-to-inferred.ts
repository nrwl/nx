import {
  createProjectGraphAsync,
  formatFiles,
  output,
  readProjectsConfigurationFromProjectGraph,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import { NoTargetsToMigrateError } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { prompt } from 'enquirer';
import {
  GeneratorInformation,
  getGeneratorInformation,
} from 'nx/src/command-line/generate/generator-utils';
import { findInstalledPlugins } from 'nx/src/utils/plugins/installed-plugins';

interface Schema {
  project?: string;
  plugins?: string[];
  skipFormat?: boolean;
}

export async function convertToInferredGenerator(tree: Tree, options: Schema) {
  const generatorChoices = await getPossibleConvertToInferredGenerators();
  let generatorsToRun: string[];

  if (process.argv.includes('--no-interactive')) {
    generatorsToRun = Array.from(generatorChoices.keys());
  } else if (options.plugins && options.plugins.length > 0) {
    generatorsToRun = Array.from(generatorChoices.values())
      .filter((generator) =>
        options.plugins.includes(generator.resolvedCollectionName)
      )
      .map(
        (generator) =>
          `${generator.resolvedCollectionName}:${generator.normalizedGeneratorName}`
      );
  } else {
    const allChoices = Array.from(generatorChoices.keys());

    generatorsToRun = (
      await prompt<{ generatorsToRun: string[] }>({
        type: 'multiselect',
        name: 'generatorsToRun',
        message: 'Which convert-to-inferred generators should be run?',
        choices: allChoices,
        initial: allChoices,
        validate: (result: string[]) => {
          if (result.length === 0) {
            return 'Please select at least one convert-to-inferred generator to run';
          }
          return true;
        },
      } as any)
    ).generatorsToRun;
  }

  if (generatorsToRun.length === 0) {
    output.error({
      title: 'Please select at least one convert-to-inferred generator to run',
    });
    return;
  }

  for (const generatorName of generatorsToRun) {
    try {
      const generator = generatorChoices.get(generatorName);
      if (generator) {
        const generatorFactory = generator.implementationFactory();
        const callback = await generatorFactory(tree, {
          project: options.project,
          skipFormat: options.skipFormat,
        });
        if (callback) {
          await callback();
        }
        output.success({
          title: `${generatorName} - Success`,
        });
      }
    } catch (e) {
      if (e instanceof NoTargetsToMigrateError) {
        output.note({
          title: `${generatorName} - Skipped (No targets to migrate)`,
        });
      } else {
        output.error({
          title: `${generatorName} - Failed`,
        });
        throw e;
      }
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

async function getPossibleConvertToInferredGenerators() {
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
        generator.generatorConfiguration['x-deprecated']
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

export default convertToInferredGenerator;
