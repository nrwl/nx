import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  readJsonInTree,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import * as path from 'path';

export default function update(): Rule {
  return chain([
    displayInformation,
    updatePackagesInPackageJson(
      path.join(__dirname, '../../../', 'migrations.json'),
      '8.7.0'
    ),
    formatFiles(),
  ]);
}

function displayInformation(host: Tree, context: SchematicContext) {
  const packageJson = readJsonInTree(host, '/package.json');
  if (packageJson['redux-starter-kit']) {
    context.logger.info(stripIndents`
    Redux Starter Kit has a breaking change for version 0.8.0.
    
    Please update \`createSlice({ slice: ... })\` with \`createSlice({ name: ... })\`.
    
    See: https://github.com/reduxjs/redux-starter-kit/releases/tag/v0.8.0 
  `);
  }
}
