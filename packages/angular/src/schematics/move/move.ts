import { chain, externalSchematic } from '@angular-devkit/schematics';
import { updateModuleName } from './lib/update-module-name';
import { Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

/**
 * Moves an Angular lib/app to another folder (and renames it in the process)
 *
 * @remarks It's important to note that `updateModuleName` is done after the update
 * to the workspace, so it can't use the same tricks as the `@nrwl/workspace` rules
 * to get the before and after names and paths.
 */
export default function (schema: Schema) {
  return chain([
    externalSchematic('@nrwl/workspace', 'move', schema),
    updateModuleName(schema),
  ]);
}
export const moveGenerator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'move'
);
