/**
 * Minimal, dependency-free PEP 440 version parsing.
 *
 * Implements just the subset of the `@renovatebot/pep440` API that this
 * project uses: `valid`, `explain`, `clean`, `major`, `minor`, `patch`.
 *
 * The regex below is a direct port of the canonical PEP 440 pattern used by
 * the Python `packaging` library (see
 * https://peps.python.org/pep-0440/#appendix-b-parsing-version-strings-with-regular-expressions).
 */

const PEP440_PATTERN =
  '^\\s*' +
  'v?' +
  '(?:' +
  '(?:(?<epoch>[0-9]+)!)?' +
  '(?<release>[0-9]+(?:\\.[0-9]+)*)' +
  '(?<pre>[-_.]?(?<pre_l>alpha|a|beta|b|preview|pre|c|rc)[-_.]?(?<pre_n>[0-9]+)?)?' +
  '(?<post>(?:-(?<post_n1>[0-9]+))|(?:[-_.]?(?<post_l>post|rev|r)[-_.]?(?<post_n2>[0-9]+)?))?' +
  '(?<dev>[-_.]?(?<dev_l>dev)[-_.]?(?<dev_n>[0-9]+)?)?' +
  ')' +
  '(?:\\+(?<local>[a-z0-9]+(?:[-_.][a-z0-9]+)*))?' +
  '\\s*$';

const PEP440_REGEX = new RegExp(PEP440_PATTERN, 'i');

const PRE_LABEL_NORMALIZATION: Record<string, string> = {
  alpha: 'a',
  a: 'a',
  beta: 'b',
  b: 'b',
  c: 'rc',
  rc: 'rc',
  pre: 'rc',
  preview: 'rc',
};

export interface Pep440Explain {
  epoch: number;
  release: number[];
  pre: [string, number] | null;
  post: number | null;
  dev: number | null;
  local: string | null;
  /** Public version identifier (canonical form without the local segment). */
  public: string;
  /** Release-only identifier: epoch + release segments, no pre/post/dev/local. */
  base_version: string;
  is_prerelease: boolean;
  is_postrelease: boolean;
  is_devrelease: boolean;
}

function match(raw: string): RegExpExecArray | null {
  return PEP440_REGEX.exec(raw);
}

/**
 * Returns `raw` itself if it's a syntactically valid PEP 440 version string,
 * `null` otherwise. Matches `@renovatebot/pep440@5`, which returns the input
 * (truthy) rather than a plain boolean.
 */
export function valid(raw: string): string | null {
  return match(raw) !== null ? raw : null;
}

/** Parses `raw` into its PEP 440 components, or `null` if invalid. */
export function explain(raw: string): Pep440Explain | null {
  const m = match(raw);
  if (!m || !m.groups) {
    return null;
  }
  const g = m.groups;

  const release = g['release'].split('.').map((n) => parseInt(n, 10));
  const epoch = g['epoch'] ? parseInt(g['epoch'], 10) : 0;

  let pre: [string, number] | null = null;
  if (g['pre_l']) {
    const label = PRE_LABEL_NORMALIZATION[g['pre_l'].toLowerCase()] ?? g['pre_l'].toLowerCase();
    pre = [label, g['pre_n'] ? parseInt(g['pre_n'], 10) : 0];
  }

  let post: number | null = null;
  if (g['post_n1'] !== undefined) {
    post = parseInt(g['post_n1'], 10);
  } else if (g['post_l'] !== undefined) {
    post = g['post_n2'] ? parseInt(g['post_n2'], 10) : 0;
  }

  let dev: number | null = null;
  if (g['dev_l'] !== undefined) {
    dev = g['dev_n'] ? parseInt(g['dev_n'], 10) : 0;
  }

  const local = g['local'] ? g['local'].replace(/[-_]/g, '.') : null;

  let base_version = '';
  if (epoch) {
    base_version += `${epoch}!`;
  }
  base_version += release.join('.');

  let publicVersion = base_version;
  if (pre) {
    publicVersion += `${pre[0]}${pre[1]}`;
  }
  if (post !== null) {
    publicVersion += `.post${post}`;
  }
  if (dev !== null) {
    publicVersion += `.dev${dev}`;
  }

  return {
    epoch,
    release,
    pre,
    post,
    dev,
    local,
    public: publicVersion,
    base_version,
    is_prerelease: pre !== null || dev !== null,
    is_postrelease: post !== null,
    is_devrelease: dev !== null,
  };
}

/** Returns a normalized canonical form of `raw`, or `null` if invalid. */
export function clean(raw: string): string | null {
  const info = explain(raw);
  if (!info) {
    return null;
  }
  let result = info.public;
  if (info.local) {
    // @renovatebot/pep440@5 joins local-version segments with commas in the
    // `clean()` output (though `explain().local` keeps them dot-separated).
    result += `+${info.local.split('.').join(',')}`;
  }
  return result;
}

function requireExplain(raw: string): Pep440Explain {
  const info = explain(raw);
  if (!info) {
    // Matches @renovatebot/pep440@5, which throws rather than returning
    // undefined for major/minor/patch on an invalid version.
    throw new TypeError(`Invalid Version: ${raw}`);
  }
  return info;
}

/** Returns the first release segment (e.g. `1` in `1.2.3`). Throws if `raw` is invalid. */
export function major(raw: string): number {
  return requireExplain(raw).release[0];
}

/** Returns the second release segment (e.g. `2` in `1.2.3`), defaulting to 0. Throws if `raw` is invalid. */
export function minor(raw: string): number {
  return requireExplain(raw).release[1] ?? 0;
}

/** Returns the third release segment (e.g. `3` in `1.2.3`), defaulting to 0. Throws if `raw` is invalid. */
export function patch(raw: string): number {
  return requireExplain(raw).release[2] ?? 0;
}
