import { fork } from 'child_process';
import { ExecutorContext, names } from '@nx/devkit';
import { join } from 'path';

export interface PlaywrightExecutorSchema {
  /*
   * if 'projects' is configured then that name needs to be provided instead of
   * all, chromium, firefox, webkit
   **/
  browser?: 'all' | 'chromium' | 'firefox' | 'webkit' | string;
  config?: string;
  debug?: boolean;
  forbidOnly?: boolean;
  fullyParallel?: boolean;
  grep?: string;
  globalTimeout?: number;
  grepInvert?: string;
  headed?: boolean;
  ignoreSnapshots?: boolean;
  workers?: string;
  list?: boolean;
  maxFailures?: number | boolean;
  noDeps?: boolean;
  output?: string;
  passWithNoTests?: boolean;
  project?: string[];
  quiet?: boolean;
  repeatEach?: number;
  reporter?:
    | 'list'
    | 'line'
    | 'dot'
    | 'json'
    | 'junit'
    | 'null'
    | 'github'
    | 'html'
    | 'blob';
  retries?: number;
  shard?: string;
  timeout?: number;
  trace?:
    | 'on'
    | 'off'
    | 'on-first-retry'
    | 'on-all-retries'
    | 'retain-on-failure';
  updateSnapshots?: boolean;
  ui?: boolean;
  uiHost?: string;
  uiPort?: string;
}

export async function playwrightExecutor(
  options: PlaywrightExecutorSchema,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectGraph?.nodes?.[context?.projectName]?.data?.root;

  if (!projectRoot) {
    throw new Error(
      `Unable to find the Project Root for ${context.projectName}. Is it set in the project.json?`
    );
  }
  const args = createArgs(options);
  const p = runPlaywright(args, context.root);

  return new Promise<{ success: boolean }>((resolve) => {
    p.on('close', (code) => {
      resolve({ success: code === 0 });
    });
  });
}

function createArgs(opts: PlaywrightExecutorSchema): string[] {
  const args: string[] = [];

  for (const key in opts) {
    const value = opts[key];
    // NOTE: playwright doesn't accept pascalCase args, only kebab-case
    const arg = names(key).fileName;

    if (Array.isArray(value)) {
      args.push(`--${arg}=${value.map((v) => v.trim()).join(',')}`);
    } else if (typeof value === 'boolean') {
      // NOTE: playwright don't accept --arg=false, instead just don't pass the arg.
      if (value) {
        args.push(`--${arg}`);
      }
    } else {
      args.push(`--${arg}=${value}`);
    }
  }

  return args;
}

function runPlaywright(args: string[], cwd: string) {
  try {
    const cli = require.resolve('@playwright/test/cli');

    return fork(cli, ['test', ...args], {
      stdio: 'inherit',
      cwd,
    });
  } catch (e) {
    console.error(e);
    throw new Error('Unable to run playwright. Is @playwright/test installed?');
  }
}

export default playwrightExecutor;
