import {
  TaskConfigurationGenerator,
  TaskConfiguration,
  Tree,
  SchematicContext
} from '@angular-devkit/schematics';

export class FormatFiles implements TaskConfigurationGenerator<any> {
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

export function wrapIntoFormat(fn: Function): any {
  return (host: Tree, context: SchematicContext) => {
    context.addTask(new FormatFiles());
    return fn(host, context)(host, context);
  };
}
