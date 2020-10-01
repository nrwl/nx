import { basename } from '@angular-devkit/core';
import { chain, Tree } from '@angular-devkit/schematics';
import {
  formatFiles,
  readJsonInTree,
  serializeJson,
  updateWorkspace,
  visitNotIgnoredFiles,
} from '@nrwl/workspace';

function updateESLintConfigReferencesInWorkspace() {
  return updateWorkspace((workspace) => {
    workspace.projects.forEach((project) => {
      const lintTarget = project.targets.get('lint');
      if (
        lintTarget?.builder !== '@nrwl/linter:eslint' &&
        (lintTarget?.builder !== '@nrwl/linter:lint' ||
          lintTarget?.options?.linter === 'tslint')
      ) {
        return;
      }

      if (lintTarget.builder === '@nrwl/linter:eslint') {
        if (!lintTarget.options.eslintConfig) {
          return;
        }
        lintTarget.options.eslintConfig = `${lintTarget.options.eslintConfig}.json`;
        return;
      }

      if (lintTarget.builder === '@nrwl/linter:lint') {
        if (!lintTarget.options.config) {
          return;
        }
        lintTarget.options.config = `${lintTarget.options.config}.json`;
        return;
      }
    });
  });
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
