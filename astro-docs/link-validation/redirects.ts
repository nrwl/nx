import fs from 'node:fs';
import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { redirects as astroRedirects } from '../redirects.mjs';

export interface RedirectRule {
  from: string;
  to: string;
}

const MAX_HOPS = 10;

function parseNetlifyRedirectsFile(content: string): RedirectRule[] {
  const rules: RedirectRule[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [from, to] = trimmed.split(/\s+/);
    if (from && to) {
      rules.push({ from, to });
    }
  }
  return rules;
}

function parseNetlifyTomlRedirects(content: string): RedirectRule[] {
  const rules: RedirectRule[] = [];
  let current: Partial<RedirectRule & { status: string }> | null = null;
  const flush = () => {
    // A 200 is a rewrite to the served file, not a redirect the browser follows.
    if (
      current?.from?.startsWith('/') &&
      current.to &&
      current.status !== '200'
    ) {
      rules.push({ from: current.from, to: current.to });
    }
    current = null;
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      flush();
      if (trimmed === '[[redirects]]') {
        current = {};
      }
      continue;
    }
    const match = /^(from|to|status)\s*=\s*"?([^"]*)"?$/.exec(trimmed);
    if (current && match) {
      current[match[1] as 'from' | 'to' | 'status'] = match[2];
    }
  }
  flush();
  return rules;
}

/**
 * Production rule order for a request to nx.dev: the nx-dev site's
 * `_redirects` run first, then `/docs/*` is proxied to astro-docs, which
 * applies its `netlify.toml` redirects and then Astro's own `redirects`.
 */
export function loadRedirectRules(): RedirectRule[] {
  const nxDevRules = parseNetlifyRedirectsFile(
    fs.readFileSync(
      path.join(workspaceRoot, 'nx-dev', 'nx-dev', '_redirects'),
      'utf-8'
    )
  );
  const astroNetlifyRules = parseNetlifyTomlRedirects(
    fs.readFileSync(
      path.join(workspaceRoot, 'astro-docs', 'netlify.toml'),
      'utf-8'
    )
  );
  const astroConfigRules = Object.entries(
    astroRedirects as Record<string, string>
  ).map(([from, to]) => ({ from: `/docs${from}`, to }));

  return [...nxDevRules, ...astroNetlifyRules, ...astroConfigRules];
}

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function applyRule(rule: RedirectRule, pathname: string): string | null {
  if (rule.from.endsWith('/*')) {
    const prefix = rule.from.slice(0, -2);
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const splat = pathname.slice(prefix.length + 1);
      return rule.to.replace(':splat', splat);
    }
    return null;
  }
  return normalizePath(rule.from) === pathname ? rule.to : null;
}

export type Resolution =
  | { ok: true; finalPath: string; hops: number }
  | { ok: false; finalPath: string; hops: number };

/**
 * Follows redirects the way Netlify does: an existing page shadows any rule
 * for its path, and otherwise the first matching rule wins.
 */
export function resolvePath(
  pathname: string,
  routes: Set<string>,
  rules: RedirectRule[]
): Resolution {
  let current = normalizePath(pathname);
  for (let hops = 0; hops <= MAX_HOPS; hops++) {
    if (routes.has(current)) {
      return { ok: true, finalPath: current, hops };
    }
    let target: string | null = null;
    for (const rule of rules) {
      target = applyRule(rule, current);
      if (target !== null) {
        break;
      }
    }
    if (target === null) {
      return { ok: false, finalPath: current, hops };
    }
    const targetUrl = new URL(target, 'https://nx.dev');
    if (targetUrl.hostname !== 'nx.dev') {
      return { ok: true, finalPath: targetUrl.href, hops: hops + 1 };
    }
    current = normalizePath(targetUrl.pathname);
  }
  return { ok: false, finalPath: current, hops: MAX_HOPS };
}
