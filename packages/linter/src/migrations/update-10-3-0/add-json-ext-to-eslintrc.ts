import { basename } from '@angular-devkit/core';
import { chain } from '@angular-devkit/schematics';
import {
  formatFiles,
  updateBuilderConfig,
  visitNotIgnoredFiles,
} from '@nrwl/workspace';

function updateESLintConfigReferencesInWorkspace() {
  return updateBuilderConfig(
    (options, target, project) => {
      if (
        target.builder === '@nrwl/linter:lint' &&
        options?.linter === 'tslint'
      ) {
        return options;
      }

      if (target.builder === '@nrwl/linter:eslint') {
        if (!options.eslintConfig) {
          return options;
        }
        options.eslintConfig = `${options.eslintConfig}.json`;
        return options;
      }

      if (target.builder === '@nrwl/linter:lint') {
        if (!options.config) {
          return options;
        }
        options.config = `${options.config}.json`;
        return options;
      }
    },
    '@nrwl/linter:eslint',
    '@nrwl/linter:lint'
  );
}

function renameESLintConfigFiles() {
  return visitNotIgnoredFiles((file, host, context) => {
    if (basename(file) !== '.eslintrc') {
      return;
    }
    // Using .eslintrc without an explicit file extension is deprecated
    const newFilePath = `${file}.json`;
    context.logger.info(`Renaming ${file} to ${newFilePath}`);
    try {
      return host.rename(file, newFilePath);
    } catch (e) {
      context.logger.error(e);
    }
  });
}

export default function () {
  return chain([
    renameESLintConfigFiles,
    updateESLintConfigReferencesInWorkspace,
    formatFiles(),
  ]);
}
