import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as semver from 'semver';
import { execCommand } from '../../lib/exec-command';
import { EngineCommand } from '../engine-adapter';

export function parseBuildxVersion(stdout: string): string {
  const match = /\sv?([0-9a-f]{7}|[0-9.]+)/.exec(stdout);
  if (!match) {
    throw new Error('Cannot parse buildx version');
  }
  return match[1];
}

export function satisfiesBuildx(version: string, range: string): boolean {
  return semver.satisfies(version, range) || /^[0-9a-f]{7}$/.test(version);
}

export function getBuildxCommand(
  args: string[],
  standalone: boolean
): EngineCommand {
  return {
    command: standalone ? 'buildx' : 'docker',
    args: standalone ? args : ['buildx', ...args],
  };
}

/**
 * Detects a buildx `--output`/`outputs` entry that resolves to the `local` or `tar` exporter (or
 * a bare path, which defaults to `local`) — those exporters are incompatible with `--iidfile`.
 */
export function isLocalOrTarExporter(outputs: string[]): boolean {
  for (const output of outputs) {
    const fields = output.split(',').map((field) => field.trim());
    if (fields.length === 1 && !fields[0].startsWith('type=')) {
      return true;
    }
    for (const field of fields) {
      const [key, value] = field.split('=').map((part) => part.trim());
      if (key === 'type' && (value === 'local' || value === 'tar')) {
        return true;
      }
    }
  }
  return false;
}

export function getImageIdFilePath(tempDir: string): string {
  return join(tempDir, 'iidfile');
}

export function readImageId(tempDir: string): string | undefined {
  const file = getImageIdFilePath(tempDir);
  if (!existsSync(file)) {
    return undefined;
  }
  return readFileSync(file, 'utf-8').trim();
}

export function getMetadataFilePath(tempDir: string): string {
  return join(tempDir, 'metadata-file');
}

export function readMetadata(tempDir: string): string | undefined {
  const file = getMetadataFilePath(tempDir);
  if (!existsSync(file)) {
    return undefined;
  }
  const content = readFileSync(file, 'utf-8').trim();
  return content === 'null' ? undefined : content;
}

export function extractDigest(
  metadata: string | undefined
): string | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(metadata);
    return parsed['containerimage.digest'] ?? undefined;
  } catch {
    return undefined;
  }
}

export async function isDockerCliAvailable(): Promise<boolean> {
  try {
    const res = await execCommand('docker', [], { silent: true });
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

export async function isBuildxAvailable(standalone: boolean): Promise<boolean> {
  try {
    const cmd = getBuildxCommand([], standalone);
    const res = await execCommand(cmd.command, cmd.args, { silent: true });
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getBuildxVersion(standalone: boolean): Promise<string> {
  const cmd = getBuildxCommand(['version'], standalone);
  const res = await execCommand(cmd.command, cmd.args, { silent: true });
  if (res.exitCode !== 0) {
    throw new Error(res.stderr.trim() || 'Failed to determine buildx version');
  }
  return parseBuildxVersion(res.stdout.trim());
}
