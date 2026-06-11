import { dirname } from 'path';

/**
 * Environment entries (npm_config_* keys) to overlay on a spawned npm process
 * so its per-key config resolution reproduces the workspace package manager's
 * own registry/auth/TLS resolution. npm parses these at its env tier: above
 * every .npmrc level, below CLI flags (we never pass registry CLI flags).
 */
export type NpmConfigEnv = Record<string, string>;

export function getPackageScope(packageName: string): string | null {
  if (packageName.startsWith('@')) {
    const slash = packageName.indexOf('/');
    if (slash > 0) {
      return packageName.slice(0, slash);
    }
  }
  return null;
}

/**
 * Converts a registry URL into npm's nerf-dart key prefix (host + directory
 * path), e.g. `https://r.example.com/npm/` -> `//r.example.com/npm/`. Returns
 * null for unparseable URLs.
 * See https://github.com/npm/cli/blob/bb056c85059cfb39514614e31abba09f20ac1612/workspaces/config/lib/nerf-dart.js#L12-L17
 */
export function nerfDart(registryUrl: string): string | null {
  try {
    const url = new URL(registryUrl);
    const dir = url.pathname.endsWith('/')
      ? url.pathname
      : url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    return `//${url.host}${dir}`;
  } catch {
    return null;
  }
}

export function setRegistry(env: NpmConfigEnv, url: string): void {
  env['npm_config_registry'] = url;
}

export function setScopedRegistry(
  env: NpmConfigEnv,
  scope: string,
  url: string
): void {
  env[`npm_config_${scope}:registry`] = url;
}

export function setAuthToken(
  env: NpmConfigEnv,
  registryUrl: string,
  token: string
): void {
  const dart = nerfDart(registryUrl);
  if (dart) {
    env[`npm_config_${dart}:_authToken`] = token;
  }
}

/** `_auth` carries base64(user:pass); callers must pass it pre-encoded. */
export function setAuthIdent(
  env: NpmConfigEnv,
  registryUrl: string,
  base64Ident: string
): void {
  const dart = nerfDart(registryUrl);
  if (dart) {
    env[`npm_config_${dart}:_auth`] = base64Ident;
  }
}

export function setCafile(env: NpmConfigEnv, path: string): void {
  env['npm_config_cafile'] = path;
}

export function setStrictSsl(env: NpmConfigEnv, value: boolean): void {
  // npm's env parser maps npm_config_strict_ssl -> strict-ssl.
  env['npm_config_strict_ssl'] = String(value);
}

export function setProxies(
  env: NpmConfigEnv,
  proxies: { httpProxy?: string; httpsProxy?: string; noProxy?: string }
): void {
  if (proxies.httpProxy) {
    env['npm_config_proxy'] = proxies.httpProxy;
  }
  if (proxies.httpsProxy) {
    env['npm_config_https_proxy'] = proxies.httpsProxy;
  }
  if (proxies.noProxy) {
    env['npm_config_noproxy'] = proxies.noProxy;
  }
}

/**
 * Directories above `root` (exclusive), nearest first, up to the filesystem
 * root. yarn classic and berry both read rc files from ancestor directories,
 * which npm never sees because its project-config walk stops at the first
 * package.json (the workspace root).
 */
export function ancestorDirectories(root: string): string[] {
  const dirs: string[] = [];
  let current = dirname(root);
  while (true) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return dirs;
}

/**
 * Expands `${VAR}` references from the environment the way npm/bun ini readers
 * do. Unknown variables are left verbatim.
 */
export function expandEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, name) => env[name] ?? match);
}

/** Case-tolerant read of an environment variable (exact, lower, upper). */
export function readEnvVar(
  env: NodeJS.ProcessEnv,
  name: string
): string | undefined {
  return env[name] ?? env[name.toLowerCase()] ?? env[name.toUpperCase()];
}
