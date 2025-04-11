import { logger } from '@nx/devkit';
import { check as portCheck } from 'tcp-port-used';

export const kill = require('kill-port');

/**
 * Kills the process on the given port
 * @param port
 * @param killPortDelay
 */
export async function killPort(
  port: number,
  killPortDelay = 2500
): Promise<boolean> {
  if (await portCheck(port)) {
    let killPortResult;
    try {
      logger.info(`Attempting to close port ${port}`);
      killPortResult = await kill(port);
      await new Promise<void>((resolve) =>
        setTimeout(() => resolve(), killPortDelay)
      );
      if (await portCheck(port)) {
        logger.error(
          `Port ${port} still open ${JSON.stringify(killPortResult)}`
        );
      } else {
        logger.info(`Port ${port} successfully closed`);
        return true;
      }
    } catch {
      logger.error(`Port ${port} closing failed`);
    }
    return false;
  } else {
    return true;
  }
}
