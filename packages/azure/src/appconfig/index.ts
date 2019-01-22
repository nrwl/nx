import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { getProjectConfig, updateProjectConfig } from '@nrwl/schematics/src/utils/ast-utils';
import { join } from 'path';

function generateFiles(schema: any): Rule {
  return (host: Tree) => {
    const project = getProjectConfig(host, schema.project);
    const templateSource = apply(
      url('./files'),
      [
        template(schema),
        move(join(project.sourceRoot, 'azure', schema.environment))
      ]
    );
    return mergeWith(templateSource);
  };
}

function registerBuilder(schema: any): Rule {
  return (host: Tree, context: SchematicContext) => {
    const project = getProjectConfig(host, schema.project);
    project.architect.deploy = {
      'builder': '@nrwl/azure:deploy',
      'options': {
        "buildTarget": `${schema.project}:build:production`
      },
      'configurations': {
        [schema.environment]: {
          'azureWebAppName': schema.azureWebAppName,
          'deployment': {
            type: 'git',
            remote: `https://${schema.azureWebAppName}.scm.azurewebsites.net:443/${schema.azureWebAppName}.git`
          }
        }
      }
    };
    updateProjectConfig(schema.project, project)(host, context);
  };
}

export default function(schema: any): Rule {
  return chain([
    branchAndMerge(chain([
      generateFiles(schema),
      registerBuilder(schema)
    ]))
  ]);
}
