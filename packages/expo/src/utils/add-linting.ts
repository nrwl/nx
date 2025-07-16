import { Linter, LinterType, lintProjectGenerator } from '@nx/eslint';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { extraEslintDependencies } from '@nx/react/src/utils/lint';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';

interface NormalizedSchema {
  linter?: Linter | LinterType;
  projectName: string;
  projectRoot: string;
  setParserOptionsProject?: boolean;
  tsConfigPaths: string[];
  skipPackageJson?: boolean;
  addPlugin?: boolean;
  buildable?: boolean;
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
    addPlugin: options.addPlugin,
    addPackageJsonDependencyChecks: options.buildable
  });

  tasks.push(lintTask);

  // Add jest.resolver.js to ignored files in dependency-checks rule
  if (isEslintConfigSupported(host)) {
    updateOverrideInLintConfig(
      host,
      options.projectRoot,
      (override) => Boolean(override.rules?.['@nx/dependency-checks']),
      (override) => {
        const rule = override.rules['@nx/dependency-checks'];
        if (Array.isArray(rule) && rule.length > 1 && rule[1].ignoredFiles) {
          rule[1].ignoredFiles.push('{projectRoot}/jest.resolver.js');
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
        'flat/react'
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
    ]);
  }

  if (!options.skipPackageJson) {
    const installTask = await addDependenciesToPackageJson(
      host,
      extraEslintDependencies.dependencies,
      extraEslintDependencies.devDependencies
    );
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}
