import { ExecutorContext } from '@nx/devkit';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { NormalizedBuildInputs } from '../engines/engine-adapter';
import { BuildExecutorSchema } from '../schema';
import { ContainerMetadataOptions } from '../../../metadata/types';

export interface NormalizedOptions {
  engine: 'docker' | 'podman';
  inputs: NormalizedBuildInputs;
  env: NodeJS.ProcessEnv;
  metadata: ContainerMetadataOptions | undefined;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Minimal dotenv-style parser for the `envFile` option — `KEY=value` per line, `#` comments,
 * optional matching single/double quotes around the value.
 */
export function parseDotEnvFile(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!existsSync(path)) {
    return result;
  }
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function getProjectRoot(context: ExecutorContext): string {
  return context.projectGraph?.nodes[context.projectName]?.data.root ?? '';
}

export function normalizeOptions(
  options: BuildExecutorSchema,
  context: ExecutorContext
): NormalizedOptions {
  const projectRoot = getProjectRoot(context);
  const defaultFile = join(context.root, projectRoot, 'Dockerfile');

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.envFile) {
    Object.assign(env, parseDotEnvFile(join(context.root, options.envFile)));
  }
  if (options.env) {
    Object.assign(env, options.env);
  }

  const inputs: NormalizedBuildInputs = {
    quiet: options.quiet ?? false,
    addHosts: toArray(options['add-hosts']),
    allow: toArray(options.allow),
    buildArgs: toArray(options['build-args']),
    buildContexts: toArray(options['build-contexts']),
    builder: options.builder,
    createBuilder: options['create-builder'] ?? false,
    cacheFrom: toArray(options['cache-from']),
    cacheTo: toArray(options['cache-to']),
    cgroupParent: options['cgroup-parent'],
    context: options.context || '.',
    file: options.file || defaultFile,
    labels: toArray(options.labels),
    load: options.load ?? false,
    network: options.network,
    noCache: options['no-cache'] ?? false,
    noCacheFilters: toArray(options['no-cache-filters']),
    outputs: toArray(options.outputs),
    platforms: toArray(options.platforms),
    provenance: options.provenance,
    pull: options.pull ?? false,
    push: options.push ?? false,
    sbom: options.sbom ?? false,
    secretFiles: toArray(options['secret-files']),
    secrets: toArray(options.secrets),
    shmSize: options['shm-size'],
    ssh: toArray(options.ssh),
    tags: toArray(options.tags),
    target: options.target,
    ulimit: toArray(options.ulimit),
  };

  const metadata: ContainerMetadataOptions | undefined = options.metadata
    ?.images
    ? {
        images: toArray(options.metadata.images),
        tags: toArray(options.metadata.tags),
        flavor: toArray(options.metadata.flavor),
        labels: toArray(options.metadata.labels),
        annotations: toArray(options.metadata.annotations),
      }
    : undefined;

  return {
    engine: options.engine ?? 'docker',
    inputs,
    env,
    metadata,
  };
}
