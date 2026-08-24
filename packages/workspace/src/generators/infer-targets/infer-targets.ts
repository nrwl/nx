import {
  NoTargetsToMigrateError,
  GeneratorInformation,
  getGeneratorInformation,
  findInstalledPlugins,
  withCentralizationSuppressed,
} from '@nx/devkit/internal';
import {
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  output,
  readProjectsConfigurationFromProjectGraph,
  runTasksInSerial,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import { prompt } from 'enquirer';

interface Schema {
  project?: string;
  plugins?: string[];
  skipFormat?: boolean;
}

export async function convertToInferredGenerator(tree: Tree, options: Schema) {
  const generatorCollectionChoices =
    await getPossibleConvertToInferredGenerators();

  if (generatorCollectionChoices.size === 0) {
    output.error({
      title:
        'No inference plugin found. For information on this migration, see https://nx.dev/recipes/running-tasks/convert-to-inferred',
    });
    return;
  }
  let generatorsToRun: string[];
  if (options.plugins && options.plugins.filter((p) => !!p).length > 0) {
    generatorsToRun = Array.from(generatorCollectionChoices.values())
      .filter((generator) =>
        options.plugins.includes(generator.resolvedCollectionName)
      )
      .map((generator) => generator.resolvedCollectionName);
  } else if (process.argv.includes('--no-interactive')) {
    generatorsToRun = Array.from(generatorCollectionChoices.keys());
  } else {
    const allChoices = Array.from(generatorCollectionChoices.keys());

    generatorsToRun = (
      await prompt<{ generatorsToRun: string[] }>({
        type: 'multiselect',
        name: 'generatorsToRun',
        message: 'Which inference plugin do you want to use?',
        choices: allChoices,
        initial: allChoices,
        validate: (result: string[]) => {
          if (result.length === 0) {
            return 'Please select at least one plugin.';
          }
          return true;
        },
      } as any)
    ).generatorsToRun;
  }

  if (generatorsToRun.length === 0) {
    output.error({
      title: 'Please select at least one plugin.',
    });
    return;
  }

  const tasks: GeneratorCallback[] = [];
  for (let i = 0; i < generatorsToRun.length; i++) {
    const generatorCollection = generatorsToRun[i];
    try {
      const generator = generatorCollectionChoices.get(generatorCollection);
      if (generator) {
        const generatorFactory = generator.implementationFactory();
        const runGenerator = () =>
          generatorFactory(tree, {
            project: options.project,
            skipFormat: options.skipFormat,
          });
        // Each conversion checks nx.json's plugins array to decide whether it
        // can centralize shared configuration, but every later conversion in
        // this loop appends its own plugin registration afterwards. Only the
        // final conversion sees the finished array, so earlier ones run with
        // centralization suppressed (they keep full per-project configuration,
        // which is lossless).
        const callback =
          i === generatorsToRun.length - 1
            ? await runGenerator()
            : await withCentralizationSuppressed(tree, runGenerator);
        if (callback) {
          const task = await callback();
          if (typeof task === 'function') tasks.push(task);
        }
        output.success({
          title: `${generatorCollection}:convert-to-inferred - Success`,
        });
      }
    } catch (e) {
      if (e instanceof NoTargetsToMigrateError) {
        output.note({
          title: `${generatorCollection}:convert-to-inferred - Skipped (No targets to migrate)`,
        });
      } else {
        output.error({
          title: `${generatorCollection}:convert-to-inferred - Failed`,
        });
        throw e;
      }
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
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

      choices.set(generator.resolvedCollectionName, generator);
    } catch {
      // this just means that no convert-to-inferred generator exists for a given collection, ignore
    }
  }

  return choices;
}

export default convertToInferredGenerator;
