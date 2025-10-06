import { logger } from '@nx/devkit';

let verboseLoggingEnabled: boolean | undefined;

function isVerboseLoggingEnabled(): boolean {
  if (verboseLoggingEnabled === undefined) {
    verboseLoggingEnabled =
      process.env.NX_DOTNET_VERBOSE_LOGGING === 'true' ||
      process.env.NX_VERBOSE_LOGGING === 'true';
  }
  return verboseLoggingEnabled;
}

export function verboseLog(message: string): void {
  if (isVerboseLoggingEnabled()) {
    logger.log(message);
  }
}

export function verboseError(message: string): void {
  if (isVerboseLoggingEnabled()) {
    logger.error(message);
  }
}
