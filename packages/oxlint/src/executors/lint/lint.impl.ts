import {
  getPackageManagerCommand,
  output,
  type ExecutorContext,
} from '@nx/devkit';
import { spawnSync } from 'node:child_process';
import { interpolate } from 'nx/src/tasks-runner/utils';

export interface OxlintExecutorSchema {
  lintFilePatterns: string[];
  config?: string;
  fix?: boolean;
  fixSuggestions?: boolean;
  fixDangerously?: boolean;
  quiet?: boolean;
  maxWarnings?: number;
  format?: string;
  denyWarnings?: boolean;
  silent?: boolean;
  tsconfig?: string;
  typeAware?: boolean;
  disableNestedConfig?: boolean;
}

export async function oxlintExecutor(
  options: OxlintExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const projectName = context.projectName;
  if (!projectName) {
    throw new Error('Executor context is missing projectName.');
  }

  const projectRoot =
    context.projectsConfigurations?.projects?.[projectName]?.root ?? '.';

  const pmc = getPackageManagerCommand();
  const execParts = pmc.exec.split(' ');
  const args = createArgs(options, projectRoot, projectName);
  // Windows only. `execParts[0]` is a bare `npx`/`pnpm`/`yarn` name that resolves
  // to a `.cmd` shim there, and libuv's PATH search probes only `.com`/`.exe`, so
  // a direct spawn is ENOENT. (Naming the `.cmd` explicitly is not the way out —
  // that throws EINVAL since the CVE-2024-27980 fix.)
  //
  // Elsewhere a shell is actively harmful: Node joins the argv into one string
  // without quoting, and `sh` has no `globstar`, so a `**` in `lintFilePatterns`
  // collapses to `*` and files below the first directory go silently unlinted.
  const useShell = process.platform === 'win32';
  const result = spawnSync(
    execParts[0],
    [...execParts.slice(1), 'oxlint', ...args],
    {
      cwd: context.root,
      stdio: 'inherit',
      shell: useShell,
      env: process.env,
      windowsHide: true,
    }
  );

  // `stdio: 'inherit'` means a failure to spawn prints nothing of its own, so
  // report it here rather than letting it read as a lint failure.
  if (result.error) {
    output.error({
      title: `Could not run Oxlint for "${projectName}"`,
      bodyLines: [
        result.error.message,
        `Command: ${pmc.exec} oxlint ${args.join(' ')}`,
        `Check that ${execParts[0]} is on your PATH.`,
      ],
    });
    return { success: false };
  }

  // A shell starts fine and reports the child's failure as its own exit code, so
  // `result.error` cannot fire under one. cmd.exe — the shell Node uses on
  // Windows — says 9009; a POSIX shell reached through a `ComSpec` override
  // would say 127.
  if (useShell && (result.status === 9009 || result.status === 127)) {
    output.error({
      title: `Could not run Oxlint for "${projectName}"`,
      bodyLines: [
        `Command: ${pmc.exec} oxlint ${args.join(' ')}`,
        `Check that ${execParts[0]} is on your PATH.`,
      ],
    });
    return { success: false };
  }

  if (result.signal) {
    output.error({
      title: `Oxlint was terminated by ${result.signal} while linting "${projectName}"`,
      bodyLines: ['This usually means the process ran out of memory.'],
    });
    return { success: false };
  }

  // Oxlint only ever exits 0 or 1 — lint errors, `--max-warnings` breaches and
  // config errors are indistinguishable without parsing `--format json`.
  return { success: result.status === 0 };
}

function createArgs(
  options: OxlintExecutorSchema,
  projectRoot: string,
  projectName: string
): string[] {
  const args: string[] = [];

  if (options.config) {
    args.push('--config', options.config);
  }
  if (options.fix) {
    args.push('--fix');
  }
  if (options.fixSuggestions) {
    args.push('--fix-suggestions');
  }
  if (options.fixDangerously) {
    args.push('--fix-dangerously');
  }
  if (options.quiet) {
    args.push('--quiet');
  }
  if (typeof options.maxWarnings === 'number') {
    args.push(`--max-warnings=${options.maxWarnings}`);
  }
  if (options.format) {
    args.push('--format', options.format);
  }
  if (options.denyWarnings) {
    args.push('--deny-warnings');
  }
  if (options.silent) {
    args.push('--silent');
  }
  if (options.tsconfig) {
    args.push('--tsconfig', options.tsconfig);
  }
  if (options.typeAware) {
    args.push('--type-aware');
  }
  if (options.disableNestedConfig) {
    args.push('--disable-nested-config');
  }

  const lintFilePatterns = options.lintFilePatterns?.length
    ? options.lintFilePatterns
    : ['{projectRoot}'];

  args.push(
    ...lintFilePatterns.map((pattern) =>
      interpolate(pattern, {
        workspaceRoot: '',
        projectRoot,
        projectName,
      }).replace(/^\.\//, '')
    )
  );

  return args;
}

export default oxlintExecutor;
