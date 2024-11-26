import {
  createProjectGraphAsync,
  logger,
  parseTargetString,
  type ProjectGraph,
  readCachedProjectGraph,
  readProjectConfiguration,
  stripIndents,
  type TargetConfiguration,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { Schema as FileServerExecutorSchema } from '../../executors/file-server/schema.d';

interface WebStaticServeSchema {
  buildTarget: string;
  outputPath?: string;
  targetName?: string;
  spa?: boolean;
}

interface NormalizedWebStaticServeSchema extends WebStaticServeSchema {
  projectName: string;
  targetName: string;
  spa: boolean;
  parsedBuildTarget: string;
}

export async function webStaticServeGenerator(
  tree: Tree,
  options: WebStaticServeSchema
) {
  const opts = await normalizeOptions(tree, options);
  addStaticConfig(tree, opts);
}

async function normalizeOptions(
  tree: Tree,
  options: WebStaticServeSchema
): Promise<NormalizedWebStaticServeSchema> {
  let projectGraph: ProjectGraph;
  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }
  const target = parseTargetString(options.buildTarget, projectGraph);
  const opts: NormalizedWebStaticServeSchema = {
    ...options,
    targetName: options.targetName || 'serve-static',
    projectName: target.project,
    spa: options.spa ?? true,
    parsedBuildTarget: target.target,
  };

  const projectConfig = readProjectConfiguration(tree, target.project);
  const buildTargetConfig = projectConfig?.targets?.[target.target];
  if (!buildTargetConfig) {
    throw new Error(stripIndents`Unable to read the target configuration for the provided build target, ${opts.buildTarget}
Are you sure this target exists?`);
  }

  if (projectConfig.targets[opts.targetName]) {
    throw new Error(stripIndents`Project ${target.project} already has a '${opts.targetName}' target configured.
Either rename or remove the existing '${opts.targetName}' target and try again.
Optionally, you can provide a different name with the --target-name option other than '${opts.targetName}'`);
  }

  // NOTE: @nx/web:file-server only looks for the outputPath option
  if (!buildTargetConfig.options?.outputPath && !opts.outputPath) {
    // attempt to find the suitable path from the outputs
    let maybeOutputValue: any;
    for (const o of buildTargetConfig?.outputs || []) {
      const isInterpolatedOutput = o.trim().startsWith('{options.');
      if (!isInterpolatedOutput) {
        continue;
      }
      const noBracketParts = o.replace(/[{}]/g, '').split('.');

      if (noBracketParts.length === 2 && noBracketParts?.[1]) {
        const key = noBracketParts[1].trim();
        const value = buildTargetConfig.options?.[key];
        if (value) {
          maybeOutputValue = value;
          break;
        }
      }
    }

    // NOTE: outputDir is the storybook option.
    opts.outputPath = buildTargetConfig.options?.outputDir || maybeOutputValue;
    if (opts.outputPath) {
      logger.warn(`Automatically detected the output path to be ${opts.outputPath}.
If this is incorrect, the update the staticFilePath option in the ${target.project}:${opts.targetName} target configuration`);
    } else {
      logger.warn(
        stripIndents`${opts.buildTarget} did not have an outputPath property set and --output-path was not provided.
Without either options, the static serve will most likely be unable to serve your project.
It's recommend to provide a --output-path option in this case.`
      );
    }
  }

  return opts;
}

function addStaticConfig(tree: Tree, opts: NormalizedWebStaticServeSchema) {
  const projectConfig = readProjectConfiguration(tree, opts.projectName);

  const staticServeOptions: TargetConfiguration<
    Partial<FileServerExecutorSchema>
  > = {
    executor: '@nx/web:file-server',
    dependsOn: [opts.parsedBuildTarget],
    options: {
      buildTarget: opts.buildTarget,
      staticFilePath: opts.outputPath,
      spa: opts.spa,
    },
  };

  projectConfig.targets[opts.targetName] = staticServeOptions;

  updateProjectConfiguration(tree, opts.projectName, projectConfig);
}

export default webStaticServeGenerator;
