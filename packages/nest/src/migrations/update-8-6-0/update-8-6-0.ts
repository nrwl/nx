import { updateJsonInTree } from '@nrwl/workspace';
import { chain, SchematicContext } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

const updateNestJs = updateJsonInTree('package.json', json => {
  json.dependencies = json.dependencies || {};
  json.devDependencies = json.devDependencies || {};
  const nestCore = json.dependencies['@nestjs/core'];
  const nestCommon = json.dependencies['@nestjs/common'];
  const nestPlatformExpress = json.dependencies['@nestjs/platform-express'];
  const nestTesting = json.devDependencies['@nestjs/testing'];

  const nestSchematics = json.devDependencies['@nestjs/schematics'];

  if (nestSchematics) {
    json['devDependencies']['@nestjs/schematics'] = '6.4.4';
  }

  if (nestTesting) {
    json['devDependencies']['@nestjs/testing'] = '6.7.1';
  }

  if (nestCore) {
    json['dependencies']['@nestjs/core'] = '6.7.1';
  }

  if (nestCommon) {
    json['dependencies']['@nestjs/common'] = '6.7.1';
  }

  if (nestPlatformExpress) {
    json['dependencies']['@nestjs/platform-express'] = '6.7.1';
  }

  return json;
});

const addInstall = (_: any, context: SchematicContext) => {
  context.addTask(new NodePackageInstallTask());
};

export default function() {
  return chain([updateNestJs, addInstall]);
}
