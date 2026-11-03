import { formatFiles, type Tree } from '@nx/devkit';
import { registerTypescriptPluginForTypecheck } from '@nx/js/internal';

export default async function update(tree: Tree) {
  if (
    !registerTypescriptPluginForTypecheck(tree, '@nx/rsbuild', {
      removeTypecheckTargetName: true,
    })
  ) {
    return { skipAgentic: true };
  }
  await formatFiles(tree);
}
