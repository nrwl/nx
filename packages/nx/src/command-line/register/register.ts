import { workspaceRoot } from '../../utils/workspace-root';
import { RegisterOptions } from './command-object';
import { requireNxKey } from '../../utils/require-nx-key';
import { reportCommandRunEvent } from '../../analytics';

export async function handleRegister(options: RegisterOptions) {
  reportCommandRunEvent('register');
  const nxKey = await requireNxKey();
  return nxKey.registerNxKey(workspaceRoot, options.key);
}
