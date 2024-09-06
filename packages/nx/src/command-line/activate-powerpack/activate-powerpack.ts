import { workspaceRoot } from '../../utils/workspace-root';
import { ActivatePowerpackOptions } from './command-object';

export async function handleActivatePowerpack(
  options: ActivatePowerpackOptions
) {
  try {
    // @ts-ignore
    const { activatePowerpack } = await import('@nx/powerpack-license');
    activatePowerpack(workspaceRoot, options.license);
  } catch (e) {
    if ('code' in e && e.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('Please install the @nx/powerpack-license package', {
        cause: e,
      });
    }
    throw e;
  }
}
