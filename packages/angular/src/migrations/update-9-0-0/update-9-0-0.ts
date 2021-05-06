import { chain, SchematicContext } from '@angular-devkit/schematics';
import { addUpdateTask, formatFiles } from '@nrwl/workspace';
import { RunSchematicTask } from '@angular-devkit/schematics/tasks';
import { join } from 'path';

export default function () {
  return (_, context: SchematicContext) => {
    const postInstallTask = context.addTask(
      new RunSchematicTask(
        join(__dirname, '../../../migrations.json'),
        'add-postinstall',
        {}
      )
    );
    return chain([
      addUpdateTask('@angular/core', '9.0.0', [postInstallTask]),
      addUpdateTask('@angular/cli', '9.0.1', [postInstallTask]),
      formatFiles(),
    ]);
  };
}
