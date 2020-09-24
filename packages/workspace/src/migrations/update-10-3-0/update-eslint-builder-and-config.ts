import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree, updatePackagesInPackageJson } from '@nrwl/workspace';
import { basename, join } from 'path';
import { formatFiles } from '../../utils/rules/format-files';
import { visitNotIgnoredFiles } from '../../utils/rules/visit-not-ignored-files';
import { updateBuilderOptions } from '../../utils/workspace';

function updateESLintConfigFiles(host: Tree, context: SchematicContext) {
  return visitNotIgnoredFiles((file, host, context) => {
    if (basename(file) !== '.eslintrc') {
      return;
    }

    // Using .eslintrc without an explicit file extension is deprecated
    const newFilePath = `${file}.json`;
    context.logger.info(`Renaming ${file} to ${newFilePath}`);
    host.rename(file, newFilePath);

    return (host, context) => {
      try {
        updateJsonInTree(newFilePath, (json) => {
          return json;
        })(host, context);
      } catch (e) {
        context.logger.warn(
          `${file} could not be migrated because it is not valid JSON`
        );
        context.logger.error(e);
      }
    };
  });
}

function updateESLintBuilder(host: Tree, context: SchematicContext) {
  const builders = ['@nrwl/linter:lint'];
  return updateBuilderOptions((options, project) => {
    return options;
  }, ...builders);
}

export default function () {
  return chain([
    updateESLintBuilder,
    updateESLintConfigFiles,
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '10.3.0'
    ),
    formatFiles(),
  ]);
}
