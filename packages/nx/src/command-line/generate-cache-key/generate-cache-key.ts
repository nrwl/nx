import { requireNxKey } from '../../utils/require-nx-key';
import { workspaceRoot } from '../../utils/workspace-root';

export async function handleGenerateCacheKey() {
  const nxKey = await requireNxKey();
  return nxKey.autoRegisterNxKey(workspaceRoot);
}
