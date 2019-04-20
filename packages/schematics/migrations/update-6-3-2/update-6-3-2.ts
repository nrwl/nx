import { Rule, Tree, SchematicContext } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { updateJsonInTree } from '@nrwl/workspace';

export default function(): Rule {
  return (host: Tree, context: SchematicContext) => {
    return updateJsonInTree('package.json', json => {
      const devDependencies = json.devDependencies;

      if (!devDependencies) {
        return json;
      }

      if (devDependencies['jest-preset-angular']) {
        devDependencies['jest-preset-angular'] = '6.0.1';
        context.addTask(new NodePackageInstallTask());
      }

      return json;
    })(host, context);
  };
}
