import { readJsonInTree } from '../ast-utils';
import {
  TaskConfigurationGenerator,
  TaskConfiguration,
  Tree,
  SchematicContext,
  Rule,
  noop
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

class FormatFiles implements TaskConfigurationGenerator<any> {
  toConfiguration(): TaskConfiguration<any> {
    return {
      name: 'node-package',
      options: {
        packageName: 'run format -- --untracked', // workaround. we should define a custom task executor.
        quiet: true
      }
    };
  }
}

export function formatFiles(
  options: { skipFormat: boolean } = { skipFormat: false }
): Rule {
  if (options.skipFormat) {
    return noop();
  }
  return (host: Tree, context: SchematicContext) => {
    const packageJson = readJsonInTree(host, 'package.json');
    if (packageJson.scripts && packageJson.scripts.format) {
      context.addTask(new FormatFiles());
    } else {
      context.logger.warn(stripIndents`
        Files were not formated during this code generation.
        The "format" npm script is missing in your package.json.
        Please either add a format script or pass --skip-format.
      `);
    }
  };
}
