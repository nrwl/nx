import { Tree } from '../../generators/tree';
import { logger } from '../../utils/logger';
import ignore from 'ignore';

export default function migrate(tree: Tree) {
  const ig = ignore();
  try {
    ig.add(tree.read('.gitignore', 'utf-8'));
    if (ig.ignores('.env')) {
      logger.warn(
        'NX The NX_ADD_PLUGINS=false environment variable was added to your .env file for backwards compatibility. However, your .env is ignored by git. Other contributors should add this key to their .env file or ensure that the environment variable is set to false when generating code with Nx.'
      );
    }
  } catch {}

  if (!tree.exists('.env')) {
    tree.write('.env', '');
  }

  const dotenv = tree.read('.env', 'utf-8');
  const newDotenvContents = [
    '# Nx 18 enables using plugins to infer targets by default',
    '# This is disabled for existing workspaces to maintain compatibility',
    '# For more info, see: https://nx.dev/concepts/inferred-tasks',
    'NX_ADD_PLUGINS=false',
  ];

  if (dotenv.length) {
    newDotenvContents.unshift(dotenv, '');
  }

  tree.write('.env', newDotenvContents.join('\n'));
}
