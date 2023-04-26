import {
  convertNxGenerator,
  logger,
  parseTargetString,
  readProjectConfiguration,
  stripIndents,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { Schema as FileServerExecutorSchema } from '../../executors/file-server/schema.d';
interface WebStaticServeSchema {
  buildTarget: string;
  outputPath?: string;
  targetName?: string;
}

interface NormalizedWebStaticServeSchema extends WebStaticServeSchema {
  projectName: string;
  targetName: string;
}

export function webStaticServeGenerator(
  tree: Tree,
  options: WebStaticServeSchema
) {
  const opts = normalizeOptions(tree, options);
  addStaticConfig(tree, opts);
}

function normalizeOptions(
  tree: Tree,
  options: WebStaticServeSchema
): NormalizedWebStaticServeSchema {
  const target = parseTargetString(options.buildTarget);
  const opts: NormalizedWebStaticServeSchema = {
    ...options,
    targetName: options.targetName || 'serve-static',
    projectName: target.project,
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
    // attempt to find the suiteable path from the outputs
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
    options: {
      buildTarget: opts.buildTarget,
      staticFilePath: opts.outputPath,
    },
  };

  projectConfig.targets[opts.targetName] = staticServeOptions;

  updateProjectConfiguration(tree, opts.projectName, projectConfig);
}

export const compat = convertNxGenerator(webStaticServeGenerator);
export default webStaticServeGenerator;
