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
  const result = spawnSync(
    execParts[0],
    [...execParts.slice(1), 'oxlint', ...args],
    {
      cwd: context.root,
      stdio: 'inherit',
      // `pmc.exec` is a `.cmd` shim on Windows, which Node refuses to spawn
      // directly since the CVE-2024-27980 fix.
      shell: true,
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
        'Check that `oxlint` is installed in this workspace.',
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
