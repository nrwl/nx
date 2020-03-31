import { chain, SchematicContext } from '@angular-devkit/schematics';
import { addUpdateTask, formatFiles } from '@nrwl/workspace';
import { RunSchematicTask } from '@angular-devkit/schematics/tasks';
import { join } from 'path';

export default function() {
  return (_, context: SchematicContext) => {
    return chain([addUpdateTask('@angular/core', '^9.1.0'), formatFiles()]);
  };
}
