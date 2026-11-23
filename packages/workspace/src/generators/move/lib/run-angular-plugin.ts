import type { Tree } from '@nx/devkit';
import type { NormalizedSchema } from '../schema';

type PluginOptions = {
  oldProjectName: string;
  newProjectName: string;
};

export async function runAngularPlugin(tree: Tree, schema: NormalizedSchema) {
  let move: ((tree: Tree, schema: PluginOptions) => Promise<void>) | undefined;
  try {
    // nx-ignore-next-line
    move = require('@nx/angular/internal').move;
  } catch {}

  if (!move) {
    return;
  }

  await move(tree, {
    oldProjectName: schema.projectName,
    newProjectName: schema.newProjectName,
  });
}
