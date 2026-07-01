import { ExecutorContext, logger } from '@nx/devkit';
import { exec, execSync } from 'node:child_process';
import { join } from 'node:path';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import type { TsdownExecutorSchema } from './schema';

function getTsdownCmd(
  options: TsdownExecutorSchema,
  projectRoot: string,
  watch = false
): string {
  const tsdownCLI = require.resolve('tsdown/dist/cli.mjs');
  const args: string[] = [];

  if (options.configFile) {
    args.push('--config', options.configFile);
  } else {
    const entries = Array.isArray(options.entry)
      ? options.entry
      : options.entry
        ? [options.entry]
        : ['src/index.ts'];
    args.push(...entries);

    if (options.outDir) {
      args.push('--out-dir', options.outDir);
    }
    if (options.format?.length) {
      args.push('--format', options.format.join(','));
    }
    if (options.dts) {
      args.push('--dts');
    }
    if (options.sourcemap) {
      args.push('--sourcemap');
    }
    if (options.clean) {
      args.push('--clean');
    }
    if (options.tsconfig) {
      args.push('--tsconfig', options.tsconfig);
    }
    if (options.minify) {
      args.push('--minify');
    }
    if (options.target) {
      args.push('--target', options.target);
    }
    if (options.platform && options.platform !== 'node') {
      args.push('--platform', options.platform);
    }
    if (options.globalName) {
      args.push('--global-name', options.globalName);
    }
    if (options.shims) {
      args.push('--shims');
    }
    if (options.skipNodeModulesBundle) {
      args.push('--deps.skip-node-modules-bundle');
    }
    if (options.external?.length) {
      for (const ext of options.external) {
        args.push('--external', ext);
      }
    }
    if (options.onSuccess) {
      args.push('--on-success', JSON.stringify(options.onSuccess));
    }
  }

  if (watch) {
    args.push('--watch');
  }

  return `node ${tsdownCLI} ${args.join(' ')}`;
}

export async function* tsdownExecutor(
  options: TsdownExecutorSchema,
  context: ExecutorContext
) {
  const { root: projectRoot } =
    context.projectsConfigurations.projects[context.projectName];
  const cwd = join(context.root, projectRoot);

  if (options.watch) {
    return yield* tsdownWatch(options, projectRoot, cwd, context);
  }

  return yield tsdownBuild(options, projectRoot, cwd, context);
}

async function tsdownBuild(
  options: TsdownExecutorSchema,
  projectRoot: string,
  cwd: string,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  logger.log(`Building with tsdown for ${context.projectName}...`);

  try {
    const cmd = getTsdownCmd(options, projectRoot);
    const output = execSync(cmd, {
      encoding: 'utf8',
      cwd,
      windowsHide: true,
      stdio: 'pipe',
    });
    if (output) {
      logger.log(output.replace(/\n$/, ''));
    }
    return { success: true };
  } catch (error) {
    logger.error(`tsdown build failed: ${error?.message ?? error}`);
    if (error?.stderr) {
      logger.error(error.stderr.toString());
    }
    if (error?.stdout) {
      logger.log(error.stdout.toString());
    }
    return { success: false };
  }
}

async function* tsdownWatch(
  options: TsdownExecutorSchema,
  projectRoot: string,
  cwd: string,
  context: ExecutorContext
) {
  logger.log(`Watching with tsdown for ${context.projectName}...`);

  return yield* createAsyncIterable<{ success: boolean }>(
    async ({ next, done }) => {
      const cmd = getTsdownCmd(options, projectRoot, true);

      const childProcess = exec(cmd, {
        cwd,
        windowsHide: true,
      });

      const processOnExit = () => {
        childProcess.kill();
        done();
        process.off('SIGINT', processOnExit);
        process.off('SIGTERM', processOnExit);
        process.off('exit', processOnExit);
      };

      childProcess.stdout?.on('data', (data: string) => {
        process.stdout.write(data);
        if (data.includes('Build complete') || data.includes('⚡')) {
          next({ success: true });
        }
      });

      childProcess.stderr?.on('data', (data: string) => {
        process.stderr.write(data);
        if (data.includes('error')) {
          next({ success: false });
        }
      });

      childProcess.on('exit', () => {
        done();
      });

      process.on('SIGINT', processOnExit);
      process.on('SIGTERM', processOnExit);
      process.on('exit', processOnExit);
    }
  );
}

export default tsdownExecutor;
