import { Linter, LinterType, lintProjectGenerator } from '@nx/eslint';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { extraEslintDependencies } from '@nx/react';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  updateOverrideInLintConfig,
  useFlatConfig,
} from '@nx/eslint/internal';

interface NormalizedSchema {
  linter?: Linter | LinterType;
  projectName: string;
  projectRoot: string;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  tsConfigPaths: string[];
  skipPackageJson?: boolean;
  addPlugin?: boolean;
  buildable?: boolean;
  isTsSolutionSetup?: boolean;
}

export async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === 'none') {
    return () => {};
  }
  const tasks: GeneratorCallback[] = [];

  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: options.tsConfigPaths,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
    enableTypedLinting: options.enableTypedLinting,
    setParserOptionsProject: options.setParserOptionsProject,
    addPlugin: options.addPlugin,
    addPackageJsonDependencyChecks: options.buildable,
  });

  tasks.push(lintTask);

  // Add ignored dependencies and files to dependency-checks rule
  if (isEslintConfigSupported(host)) {
    updateOverrideInLintConfig(
      host,
      options.projectRoot,
      (override) => Boolean(override.rules?.['@nx/dependency-checks']),
      (override) => {
        const rule = override.rules['@nx/dependency-checks'] as
          | string
          | [string, { ignoredDependencies?: string[] }];
        if (Array.isArray(rule) && rule.length > 1) {
          // Ensure ignoredDependencies array exists
          if (!rule[1].ignoredDependencies) {
            rule[1].ignoredDependencies = [];
          }

          // Add ignored dependencies if they don't already exist
          const ignoredDeps = [
            '@nx/jest',
            '@nx/rollup',
            '@rollup/plugin-url',
            '@svgr/rollup',
            'jest-expo',
          ];
          for (const dep of ignoredDeps) {
            if (!rule[1].ignoredDependencies.includes(dep)) {
              rule[1].ignoredDependencies.push(dep);
            }
          }
        }
        return override;
      }
    );
  }

  if (isEslintConfigSupported(host)) {
    if (useFlatConfig(host)) {
      addPredefinedConfigToFlatLintConfig(
        host,
        options.projectRoot,
        'flat/react',
        { checkBaseConfig: true }
      );
      // Add an empty rules object to users know how to add/override rules
      addOverrideToLintConfig(host, options.projectRoot, {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        rules: {},
      });
    } else {
      const addExtendsTask = addExtendsToLintConfig(host, options.projectRoot, {
        name: 'plugin:@nx/react',
        needCompatFixup: true,
      });
      tasks.push(addExtendsTask);
    }
    addIgnoresToLintConfig(host, options.projectRoot, [
      '.expo',
      'web-build',
      'cache',
      'dist',
      ...(options.isTsSolutionSetup ? ['**/out-tsc'] : []),
    ]);
  }

  if (!options.skipPackageJson) {
    const installTask = await addDependenciesToPackageJson(
      host,
      extraEslintDependencies.dependencies,
      extraEslintDependencies.devDependencies,
      undefined,
      true
    );
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}
