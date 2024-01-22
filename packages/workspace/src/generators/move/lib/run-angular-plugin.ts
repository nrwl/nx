import type { Tree } from '@nx/devkit';
import type { Schema } from '../schema';

type PluginOptions = {
  oldProjectName: string;
  newProjectName: string;
};

export async function runAngularPlugin(tree: Tree, schema: Schema) {
  let move: (tree: Tree, schema: PluginOptions) => Promise<void>;
  try {
    // nx-ignore-next-line
    move = require('@nx/angular/src/generators/move/move-impl').move;
  } catch {}

  if (!move) {
    return;
  }

  await move(tree, {
    oldProjectName: schema.projectName,
    newProjectName: schema.newProjectName,
  });
}
