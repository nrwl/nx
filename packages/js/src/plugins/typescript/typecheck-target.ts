import type { getPackageManagerCommand, TargetConfiguration } from '@nx/devkit';

const DEFAULT_TSCONFIG = 'tsconfig.json';

export interface TypecheckTargetOptions {
  /**
   * `build` runs `tsc --build --emitDeclarationOnly` for TS solution setups.
   * `noEmit` runs `tsc --noEmit -p <tsconfig>`.
   */
  mode: 'build' | 'noEmit';
  /**
   * Project root, used as the command's cwd.
   */
  projectRoot: string;
  pmc: ReturnType<typeof getPackageManagerCommand>;
  /**
   * Defaults to `tsconfig.json`, which is left out of the command.
   */
  tsConfig?: string;
  /**
   * Defaults to `tsc`.
   */
  compiler?: string;
  /**
   * Name of the typecheck target, for the dependency on referenced projects
   * in `build` mode. Defaults to `typecheck`.
   */
  targetName?: string;
  /**
   * The project's build target, which `build` mode runs first.
   */
  buildTargetName?: string;
  /**
   * Defaults to the `production` (or `default`) named input plus the
   * compiler package.
   */
  inputs?: TargetConfiguration['inputs'];
  namedInputs?: Record<string, unknown>;
  outputs?: string[];
  technologies?: string[];
  verboseOutput?: boolean;
}

/**
 * Builds a `typecheck` target. Plugins that infer one share this shape so
 * their targets stay compatible with the one `@nx/js/typescript` infers.
 */
export function createTypecheckTarget(
  options: TypecheckTargetOptions
): TargetConfiguration {
  const compiler = options.compiler ?? 'tsc';
  const tsConfigArg = getTsConfigArg(options.tsConfig);

  const target: TargetConfiguration = {
    command:
      options.mode === 'build'
        ? `${compiler} --build${tsConfigArg} --emitDeclarationOnly${
            options.verboseOutput ? ' --verbose' : ''
          }`
        : `${compiler}${tsConfigArg ? ` -p${tsConfigArg}` : ''} --noEmit`,
    options: { cwd: options.projectRoot },
    cache: true,
    inputs:
      options.inputs ??
      getDefaultTypecheckInputs(options.namedInputs ?? {}, compiler),
    metadata: {
      technologies: options.technologies ?? ['typescript'],
      description: 'Runs type-checking for the project.',
      help:
        options.mode === 'build'
          ? {
              command: `${options.pmc.exec} ${compiler} --build --help`,
              example: { args: ['--force'] },
            }
          : {
              command: `${options.pmc.exec} ${compiler}${
                tsConfigArg ? ` -p${tsConfigArg}` : ''
              } --help`,
              example: { options: { noEmit: true } },
            },
    },
  };

  if (options.outputs) {
    target.outputs = options.outputs;
  }

  if (options.mode === 'build') {
    target.dependsOn = [`^${options.targetName ?? 'typecheck'}`];
    if (options.buildTargetName) {
      target.dependsOn.unshift(options.buildTargetName);
    }
    target.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return target;
}

/**
 * The tsconfig a `noEmit` typecheck target should check, from the files next
 * to the project's config: the app, then the lib, then the root tsconfig.
 */
export function selectTypecheckTsConfig(
  tsConfigFiles: string[]
): string | undefined {
  return (
    ['tsconfig.app.json', 'tsconfig.lib.json', DEFAULT_TSCONFIG].find((file) =>
      tsConfigFiles.includes(file)
    ) ?? tsConfigFiles[0]
  );
}

/**
 * ` <tsconfig>` for a tsc command, or an empty string for `tsconfig.json`,
 * which tsc reads by default.
 */
export function getTsConfigArg(tsConfig: string | undefined): string {
  return !tsConfig || tsConfig === DEFAULT_TSCONFIG ? '' : ` ${tsConfig}`;
}

function getDefaultTypecheckInputs(
  namedInputs: Record<string, unknown>,
  compiler: string
): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    { externalDependencies: getCompilerPackages(compiler) },
  ];
}

function getCompilerPackages(compiler: string): string[] {
  switch (compiler) {
    case 'tsgo':
      return ['@typescript/native-preview'];
    case 'vue-tsc':
      return ['vue-tsc', 'typescript'];
    default:
      return ['typescript'];
  }
}
