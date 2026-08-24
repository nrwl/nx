import {
  NoTargetsToMigrateError,
  GeneratorInformation,
  getGeneratorInformation,
  findInstalledPlugins,
  finalizeBatchConversion,
  openBatchConversionSession,
  multiselectPrompt,
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

    generatorsToRun = await multiselectPrompt({
      message: 'Which inference plugin do you want to use?',
      choices: allChoices,
      initialValues: allChoices,
      required: true,
    });
  }

  if (generatorsToRun.length === 0) {
    output.error({
      title: 'Please select at least one plugin.',
    });
    return;
  }

  const tasks: GeneratorCallback[] = [];
  // Each conversion checks nx.json's plugins array to decide whether it can
  // centralize shared configuration, but every later conversion in this loop
  // appends its own plugin registration afterwards. A batch session defers
  // centralization to a single finalize pass that observes the finished array,
  // so every conversion in the batch can centralize; a lone conversion already
  // sees the finished array and takes the inline path.
  const session =
    generatorsToRun.length > 1 ? openBatchConversionSession(tree) : undefined;
  try {
    for (const generatorCollection of generatorsToRun) {
      try {
        const generator = generatorCollectionChoices.get(generatorCollection);
        if (generator) {
          const generatorFactory = generator.implementationFactory();
          const runGenerator = () =>
            generatorFactory(tree, {
              project: options.project,
              skipFormat: options.skipFormat,
            });
          const callback = session
            ? await session.runChild(runGenerator)
            : await runGenerator();
          if (callback) {
            tasks.push(async () => {
              const task: unknown = await callback();
              if (typeof task === 'function') await task();
            });
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

    if (session) {
      // Never throws: a failed finalize downgrades to a warning and leaves the
      // conservative per-project configuration, so the queued callbacks below
      // still run.
      await finalizeBatchConversion(tree, session);
    }
  } finally {
    session?.close();
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
