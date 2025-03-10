import { workspaceRoot } from '../../utils/workspace-root';
import { ActivateKeyOptions } from './command-object';
import { prompt } from 'enquirer';
import { requireNxKey } from '../../utils/require-nx-key';

export async function handleActivateKey(options: ActivateKeyOptions) {
  const key =
    options.key ??
    (await prompt({
      type: 'input',
      name: 'key',
      message: 'Enter your key',
    }));
  const { activateNxKey } = await requireNxKey();
  activateNxKey(workspaceRoot, key);
}
