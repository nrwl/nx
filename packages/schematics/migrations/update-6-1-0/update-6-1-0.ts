import {
  Rule,
  Tree,
  SchematicContext,
  chain
} from '@angular-devkit/schematics';
import { updateJsonInTree } from '../../src/utils/ast-utils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

function displayInformation(host: Tree, context: SchematicContext) {
  context.logger.info(stripIndents`
    "implicitDependencies" have been added to your nx.json.
  `);
  context.logger.warn(stripIndents`
    Files not defined in implicitDependencies will NOT affect your projects.

    .ie yarn affected:apps --files=README.md will return no apps since it is not defined.

    You should add additional files which you expect to affect your projects into this configuration.
  `);
}

const addImplicitDependencies = updateJsonInTree('nx.json', nxJson => {
  return {
    ...nxJson,
    implicitDependencies: {
      'angular.json': '*',
      'package.json': '*',
      'tsconfig.json': '*',
      'tslint.json': '*',
      'nx.json': '*'
    }
  };
});

const changeNpmRunUpdate = updateJsonInTree('package.json', packageJson => {
  packageJson.scripts.update = 'ng update @nrwl/schematics';
  packageJson.scripts['update:check'] = 'ng update';
  delete packageJson.scripts['update:skip'];
  return packageJson;
});

export default function(): Rule {
  return chain([
    displayInformation,
    addImplicitDependencies,
    changeNpmRunUpdate
  ]);
}
