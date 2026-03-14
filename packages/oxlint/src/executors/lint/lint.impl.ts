import { ExecutorContext, getPackageManagerCommand } from '@nx/devkit';
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
  experimentalNestedConfig?: boolean;
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
      env: process.env,
    }
  );

  return { success: (result.status ?? 1) === 0 };
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
    args.push('--max-warnings', String(options.maxWarnings));
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
  if (options.experimentalNestedConfig) {
    args.push('--experimental-nested-config');
  }

  const lintFilePatterns = options.lintFilePatterns?.length
    ? options.lintFilePatterns
    : ['{projectRoot}'];

  const normalizedPatterns = lintFilePatterns.map((pattern) => {
    const interpolated = interpolate(pattern, {
      workspaceRoot: '',
      projectRoot,
      projectName,
    });
    const normalized = interpolated.replace(/^\.\//, '');
    if (normalized === projectRoot) {
      return projectRoot === '.' ? '.' : projectRoot;
    }
    if (projectRoot !== '.' && normalized.startsWith(`${projectRoot}/`)) {
      return normalized;
    }
    return normalized;
  });

  args.push(...normalizedPatterns);
  return args;
}

export default oxlintExecutor;
