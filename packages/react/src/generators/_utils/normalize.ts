import { names, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/internal';

export type SupportedBundler = 'vite' | 'rsbuild' | 'rspack';
export type SupportedSurface = 'consumer' | 'provider';

// Default ports are split so a `consumer` + `provider` generated with no
// overrides don't collide. Consumer gets the round base (the user navigates
// to it); providers get base+1, base+2, etc., so a manifest pointing at
// `consumer-base + 1` lines up with the first generated provider.
//
// Vite base deliberately avoids 5000 (macOS AirTunes binds it on the IPv4
// wildcard, leading to silent EADDRINUSE on `127.0.0.1`).
const DEFAULT_BASE_PORTS: Record<SupportedBundler, number> = {
  vite: 5100,
  rsbuild: 3100,
  rspack: 8100,
};

export interface NormalizedScaffoldOptions {
  projectName: string;
  federationName: string;
  bundler: SupportedBundler;
  port: number;
  projectRoot: string;
}

export interface RawScaffoldOptions {
  directory: string;
  surface: SupportedSurface;
  bundler?: SupportedBundler;
  port?: number;
}

export function getDefaultPort(
  bundler: SupportedBundler,
  surface: SupportedSurface
): number {
  const base = DEFAULT_BASE_PORTS[bundler];
  return surface === 'consumer' ? base : base + 1;
}

// Federation `name` must be a JS identifier so the bundler can use it as a
// global namespace. Hyphens are allowed in project names but invalid as an
// identifier, so we coerce to underscores.
export function toFederationName(projectName: string): string {
  if (!/[A-Za-z0-9]/.test(projectName)) {
    throw new Error(
      `Cannot derive a federation name from project name '${projectName}'. Use letters, digits, hyphens, or underscores.`
    );
  }
  const candidate = projectName
    .replace(/-/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
  if (/^[0-9]/.test(candidate)) {
    throw new Error(
      `Federation name '${candidate}' (derived from project '${projectName}') cannot start with a digit. Rename the project.`
    );
  }
  return candidate;
}

export async function normalizeScaffoldOptions(
  tree: Tree,
  raw: RawScaffoldOptions
): Promise<NormalizedScaffoldOptions> {
  const bundler: SupportedBundler = raw.bundler ?? 'vite';
  const { projectName, projectRoot } = await determineProjectNameAndRootOptions(
    tree,
    {
      projectType: 'application',
      directory: raw.directory,
    }
  );
  const federationName = toFederationName(names(projectName).fileName);
  const port = raw.port ?? getDefaultPort(bundler, raw.surface);
  return { projectName, federationName, bundler, port, projectRoot };
}
