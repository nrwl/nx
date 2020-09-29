import {
  chain,
  noop,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { updatePackagesInPackageJson } from '@nrwl/workspace';
import { join } from 'path';
import { formatFiles } from '../../utils/rules/format-files';
import { updateBuilderOptions } from '../../utils/workspace';

function updateESLintBuilder(host: Tree, context: SchematicContext) {
  const builders = ['@nrwl/linter:lint'];
  return updateBuilderOptions((options, project) => {
    return options;
  }, ...builders);
}

const updateRootESLintConfig = noop;

export default function () {
  return chain([
    updateESLintBuilder,
    updateRootESLintConfig,
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '10.3.0'
    ),
    formatFiles(),
  ]);
}
