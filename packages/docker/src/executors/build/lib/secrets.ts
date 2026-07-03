import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { interpolateEnvVar } from '../../../utils/env-interpolate';

/**
 * Resolves a `key=value` (or, when `isFile`, `key=path`) secret entry into a
 * `docker buildx build`/`podman build` compatible `--secret id=key,src=tmpfile` argument, writing
 * the (env-interpolated) secret value out to a file inside `tempDir`.
 */
export function resolveSecretArg(
  entry: string,
  tempDir: string,
  isFile: boolean
): string {
  const delimiterIndex = entry.indexOf('=');
  const key = delimiterIndex === -1 ? '' : entry.slice(0, delimiterIndex);
  const rawValue = delimiterIndex === -1 ? '' : entry.slice(delimiterIndex + 1);
  if (key.length === 0 || rawValue.length === 0) {
    throw new Error(`${entry} is not a valid secret`);
  }

  const interpolated = interpolateEnvVar(rawValue);
  let value: string;
  if (isFile) {
    if (!existsSync(interpolated)) {
      throw new Error(`secret file ${interpolated} not found`);
    }
    value = readFileSync(interpolated, 'utf-8');
  } else {
    value = interpolated;
  }

  const secretFile = join(tempDir, `secret-${randomBytes(8).toString('hex')}`);
  writeFileSync(secretFile, value);
  return `id=${key},src=${secretFile}`;
}
