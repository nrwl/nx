import { workspaceRoot } from '../../utils/workspace-root';
import { RegisterOptions } from './command-object';
import { requireNxKey } from '../../utils/require-nx-key';

export async function handleRegister(options: RegisterOptions) {
  const nxKey = await requireNxKey();
  return nxKey.registerNxKey(workspaceRoot, options.key);
}
