import { workspaceRoot } from '../../utils/workspace-root.js';
import { RegisterOptions } from './command-object.js';
import { requireNxKey } from '../../utils/require-nx-key.js';

export async function handleRegister(options: RegisterOptions) {
  const nxKey = await requireNxKey();
  return nxKey.registerNxKey(workspaceRoot, options.key);
}
