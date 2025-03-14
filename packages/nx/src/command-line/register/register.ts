import { workspaceRoot } from '../../utils/workspace-root';
import { RegisterOptions } from './command-object';
import { prompt } from 'enquirer';
import { requireNxKey } from '../../utils/require-nx-key';

export async function handleRegister(options: RegisterOptions) {
  const nxKey = await requireNxKey();

  // If a key was provided through options, activate it directly
  if (options.key) {
    return nxKey.activateNxKey(workspaceRoot, options.key);
  }

  // Try to auto-register a key
  const generatedKey = await nxKey.autoRegisterNxKey(workspaceRoot);
  if (generatedKey) {
    return;
  }

  // If auto-registration was skipped, prompt for a key
  const { key } = await prompt<{ key: string }>({
    type: 'input',
    name: 'key',
    message: 'Enter your key',
  });

  return nxKey.activateNxKey(workspaceRoot, key);
}
