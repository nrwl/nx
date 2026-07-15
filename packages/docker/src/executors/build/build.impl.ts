import { ExecutorContext, logger } from '@nx/devkit';
import { computeContainerMetadata } from '../../metadata/compute-metadata';
import { interpolateEnvVar } from '../../utils/env-interpolate';
import { EngineContext } from './engines/engine-adapter';
import { createEngine } from './engines/engine-factory';
import { execCommand } from './lib/exec-command';
import { getProjectRoot, normalizeOptions } from './lib/normalize-options';
import { writeExecutorOutput } from './lib/outputs';
import {
  cleanupTempWorkspace,
  createTempWorkspace,
} from './lib/temp-workspace';
import { BuildExecutorSchema } from './schema';

export default async function buildExecutor(
  schema: BuildExecutorSchema,
  context: ExecutorContext
) {
  const tempDir = createTempWorkspace();

  try {
    const {
      engine: engineName,
      inputs,
      env,
      metadata,
    } = normalizeOptions(schema, context);
    const projectName = context.projectName ?? '';
    const engineCtx: EngineContext = { projectName, tempDir };

    if (metadata) {
      const computed = computeContainerMetadata({
        options: metadata,
        projectRoot: getProjectRoot(context),
        workspaceRoot: context.root,
      });
      inputs.tags = computed.tags;
      inputs.labels = computed.labels;
    }

    const engine = createEngine(engineName);
    const runtime = await engine.initialize(inputs, engineCtx);

    const args = await engine.buildArgs(inputs, '.', engineCtx, runtime);
    const command = engine.getCommand(args, runtime);
    const res = await execCommand(
      command.command,
      command.args.map((arg) => interpolateEnvVar(arg)),
      { cwd: context.root, env }
    );
    if (res.exitCode !== 0) {
      throw new Error(
        `${engineName} build failed with: ${res.stderr.trim() || 'unknown error'}`
      );
    }

    await engine.finalize(inputs, engineCtx, runtime);

    const imageId = engine.getImageId(engineCtx);
    const metadataOutput = engine.getMetadata(engineCtx);
    const digest = engine.getDigest(metadataOutput);

    if (imageId) {
      logger.log(imageId);
      writeExecutorOutput(projectName, 'imageid', imageId);
    }
    if (digest) {
      logger.log(digest);
      writeExecutorOutput(projectName, 'digest', digest);
    }
    if (metadataOutput) {
      writeExecutorOutput(projectName, 'metadata', metadataOutput);
    }

    return { success: true };
  } finally {
    cleanupTempWorkspace(tempDir);
  }
}
