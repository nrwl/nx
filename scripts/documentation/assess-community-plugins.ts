/**
 * Assess the health of approved community plugins.
 *
 * For each plugin in `astro-docs/src/content/approved-community-plugins.json`,
 * fetches:
 *   - npm: last publish date, monthly downloads, declared Nx peer/dep range
 *   - GitHub (if listing URL is a github.com URL): stargazers, archived flag,
 *     repo existence (404 detection)
 *
 * Produces a verdict per plugin (healthy / stale / abandoned / incompatible)
 * plus a written report in `tmp/notes/`.
 *
 * Run:
 *   npx tsx scripts/documentation/assess-community-plugins.ts
 *
 * GitHub calls go through the `gh` CLI (so they use your existing `gh auth
 * login` token). If `gh` is not installed or not authenticated, star counts
 * and archive/404 checks are skipped.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import * as semver from 'semver';

// ============================================================
// Tunable thresholds — adjust these to change the verdict rules
// ============================================================
const THRESHOLDS = {
  // "stale" if no publish in this many months
  staleMonths: 12,
  // "abandoned" if no publish in this many months, or repo 404/archived.
  // Rationale: Nx ships a major ~every 6 months, so 24 months ≈ 4 majors
  // behind — well past the point where compatibility can be assumed.
  abandonedMonths: 24,
  // downloads below this count as "low usage" (used for stale verdict)
  lowMonthlyDownloads: 100,
  // how many Nx majors back a plugin can be and still count as compatible
  // e.g. 2 means current, current-1, and current-2 are all accepted
  nxMajorLookback: 2,
};
const REPO_ROOT = resolve(__dirname, '..', '..');
const PLUGINS_FILE = join(
  REPO_ROOT,
  'astro-docs',
  'src',
  'content',
  'approved-community-plugins.json'
);
const OUTPUT_DIR = join(REPO_ROOT, 'tmp', 'notes');
// ============================================================

function readCurrentNxMajor(): number {
  const pkg = JSON.parse(
    readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')
  );
  const range: string = pkg.devDependencies?.nx || pkg.dependencies?.nx || '';
  const match = range.match(/(\d+)/);
  if (!match)
    throw new Error(
      'Could not determine current Nx major from root package.json'
    );
  return Number(match[1]);
}

const CURRENT_NX_MAJOR = readCurrentNxMajor();
const SUPPORTED_NX_MAJORS = Array.from(
  { length: THRESHOLDS.nxMajorLookback + 1 },
  (_, i) => CURRENT_NX_MAJOR - THRESHOLDS.nxMajorLookback + i
);

interface CommunityPlugin {
  name: string;
  description: string;
  url: string;
}

interface Assessment {
  name: string;
  url: string;
  description: string;
  monthlyDownloads: number | null;
  lastPublishedDate: string | null;
  monthsSinceLastPublish: number | null;
  nxVersionRange: string;
  compatibleNxMajors: number[] | null;
  githubStars: number | null;
  githubRepo: string | null;
  repoStatus: 'ok' | 'archived' | 'not_found' | 'not_github' | 'unchecked';
  verdict: 'healthy' | 'stale' | 'abandoned' | 'incompatible';
  reasons: string[];
}

function assertGhCli(): void {
  const res = spawnSync('gh', ['--version'], { stdio: 'ignore' });
  if (res.status !== 0) {
    throw new Error(
      '`gh` CLI not found. Install it (https://cli.github.com) and run `gh auth login`.'
    );
  }
}
assertGhCli();

// Serialize all npm requests through a single queue so concurrent callers
// (e.g. Promise.all over data+downloads) don't both race past the throttle.
let npmQueue: Promise<void> = Promise.resolve();
const NPM_MIN_INTERVAL_MS = 250;
async function withNpmThrottle<T>(fn: () => Promise<T>): Promise<T> {
  const prev = npmQueue;
  let release: () => void;
  npmQueue = new Promise<void>((r) => (release = r));
  await prev;
  try {
    return await fn();
  } finally {
    setTimeout(() => release!(), NPM_MIN_INTERVAL_MS);
  }
}

async function npmFetch(url: string, attempt = 0): Promise<Response> {
  const res = await withNpmThrottle(() => fetch(url));
  if (res.status === 429 && attempt < 3) {
    const backoff = 2000 * Math.pow(2, attempt);
    console.warn(`npm 429 on ${url} — backing off ${backoff}ms`);
    await new Promise((r) => setTimeout(r, backoff));
    return npmFetch(url, attempt + 1);
  }
  return res;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') return null;
    const [, owner, repo] = parsed.pathname.split('/');
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

async function fetchNpmData(name: string): Promise<{
  lastPublishedDate: Date | null;
  nxVersionRange: string;
}> {
  const res = await npmFetch(`https://registry.npmjs.org/${name}`);
  if (res.status === 404) {
    return { lastPublishedDate: null, nxVersionRange: '' };
  }
  if (!res.ok) {
    throw new Error(`npm registry ${res.status} for ${name}`);
  }
  const data = (await res.json()) as any;
  const latest = data['dist-tags']?.latest;
  const lastPublishedDate = data.time?.[latest]
    ? new Date(data.time[latest])
    : null;
  const version = data.versions?.[latest] ?? {};
  const nxVersionRange =
    version.peerDependencies?.['@nx/devkit'] ||
    version.dependencies?.['@nx/devkit'] ||
    version.peerDependencies?.['@nx/workspace'] ||
    version.dependencies?.['@nx/workspace'] ||
    version.peerDependencies?.nx ||
    version.dependencies?.nx ||
    '';
  return { lastPublishedDate, nxVersionRange };
}

async function fetchNpmDownloads(name: string): Promise<number | null> {
  const res = await npmFetch(
    `https://api.npmjs.org/downloads/point/last-month/${name}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`npm downloads ${res.status} for ${name}`);
  }
  const data = (await res.json()) as any;
  // 404-style body: { error: "package ... not found" } — no downloads field
  if (typeof data.downloads !== 'number') return null;
  return data.downloads;
}

function fetchGithubRepo(
  owner: string,
  repo: string
): { stars: number; archived: boolean; status: 'ok' | 'not_found' } {
  const res = spawnSync('gh', ['api', `repos/${owner}/${repo}`], {
    encoding: 'utf-8',
  });
  if (res.status !== 0) {
    const stderr = res.stderr || '';
    if (/HTTP 404|Not Found/i.test(stderr)) {
      return { stars: 0, archived: false, status: 'not_found' };
    }
    throw new Error(`gh api failed for ${owner}/${repo}: ${stderr.trim()}`);
  }
  const data = JSON.parse(res.stdout) as any;
  return {
    stars: data.stargazers_count ?? 0,
    archived: !!data.archived,
    status: 'ok',
  };
}

function supportsMajor(range: string, major: number): boolean {
  // A plugin "supports" major X if its declared range intersects anywhere
  // within X.x. This treats exact pins (e.g. "21.6.7") and narrow ranges
  // as still targeting their major, matching author intent.
  try {
    return semver.intersects(range, `${major}.x`, { includePrerelease: true });
  } catch {
    return false;
  }
}

function checkCompatibleMajors(
  range: string,
  majors: number[]
): number[] | null {
  if (!range) return null;
  return majors.filter((m) => supportsMajor(range, m));
}

function assess(
  plugin: CommunityPlugin,
  npm: { lastPublishedDate: Date | null; nxVersionRange: string },
  downloads: number | null,
  gh: {
    stars: number | null;
    archived: boolean;
    status: Assessment['repoStatus'];
  },
  githubRepo: string | null
): Assessment {
  const now = new Date();
  const monthsSince = npm.lastPublishedDate
    ? monthsBetween(npm.lastPublishedDate, now)
    : null;
  const compatibleMajors = checkCompatibleMajors(
    npm.nxVersionRange,
    SUPPORTED_NX_MAJORS
  );
  const incompatible =
    compatibleMajors !== null && compatibleMajors.length === 0;

  const reasons: string[] = [];

  if (gh.status === 'not_found') reasons.push('GitHub repo returns 404');
  if (gh.archived) reasons.push('GitHub repo is archived');
  if (monthsSince !== null && monthsSince > THRESHOLDS.abandonedMonths) {
    reasons.push(
      `last published ${monthsSince.toFixed(1)} months ago (> ${THRESHOLDS.abandonedMonths})`
    );
  } else if (monthsSince !== null && monthsSince > THRESHOLDS.staleMonths) {
    reasons.push(
      `last published ${monthsSince.toFixed(1)} months ago (> ${THRESHOLDS.staleMonths})`
    );
  }
  if (downloads !== null && downloads < THRESHOLDS.lowMonthlyDownloads) {
    reasons.push(
      `${downloads} monthly downloads (< ${THRESHOLDS.lowMonthlyDownloads})`
    );
  }
  if (incompatible) {
    reasons.push(
      `declared Nx range "${npm.nxVersionRange}" does not include Nx ${SUPPORTED_NX_MAJORS.join(' or ')}`
    );
  }

  let verdict: Assessment['verdict'];
  if (
    gh.status === 'not_found' ||
    gh.archived ||
    (monthsSince !== null && monthsSince > THRESHOLDS.abandonedMonths)
  ) {
    verdict = 'abandoned';
  } else if (incompatible) {
    verdict = 'incompatible';
  } else if (
    (monthsSince !== null && monthsSince > THRESHOLDS.staleMonths) ||
    (downloads !== null && downloads < THRESHOLDS.lowMonthlyDownloads)
  ) {
    verdict = 'stale';
  } else {
    verdict = 'healthy';
  }

  return {
    name: plugin.name,
    url: plugin.url,
    description: plugin.description,
    monthlyDownloads: downloads,
    lastPublishedDate: npm.lastPublishedDate
      ? npm.lastPublishedDate.toISOString().slice(0, 10)
      : null,
    monthsSinceLastPublish:
      monthsSince === null ? null : Number(monthsSince.toFixed(1)),
    nxVersionRange: npm.nxVersionRange,
    compatibleNxMajors: compatibleMajors,
    githubStars: gh.stars,
    githubRepo,
    repoStatus: gh.status,
    verdict,
    reasons,
  };
}

function renderMarkdown(assessments: Assessment[]): string {
  const majorsCol = (majors: number[] | null) =>
    majors === null ? 'n/a' : majors.length === 0 ? 'none' : majors.join(', ');
  const bucket = (v: Assessment['verdict']) =>
    assessments
      .filter((a) => a.verdict === v)
      .sort((a, b) => (a.monthlyDownloads ?? -1) - (b.monthlyDownloads ?? -1));

  const lines: string[] = [];
  lines.push('# Community plugins assessment');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total plugins assessed: ${assessments.length}`);
  lines.push(
    `Supported Nx majors (for compat check): ${SUPPORTED_NX_MAJORS.join(', ')}`
  );
  lines.push('');
  lines.push('## Thresholds');
  lines.push('');
  lines.push('```');
  lines.push(JSON.stringify(THRESHOLDS, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Verdict | Count |');
  lines.push('| --- | ---: |');
  for (const v of ['healthy', 'stale', 'incompatible', 'abandoned'] as const) {
    lines.push(`| ${v} | ${bucket(v).length} |`);
  }
  lines.push('');

  const section = (title: string, v: Assessment['verdict']) => {
    const items = bucket(v);
    lines.push(`## ${title} (${items.length})`);
    lines.push('');
    if (items.length === 0) {
      lines.push('_None._');
      lines.push('');
      return;
    }
    lines.push(
      '| Plugin | Downloads/mo | Last publish | Months since | Nx range | Supports | Stars | Repo | Reasons |'
    );
    lines.push('| --- | ---: | --- | ---: | --- | --- | ---: | --- | --- |');
    for (const a of items) {
      lines.push(
        `| [${a.name}](${a.url}) | ${a.monthlyDownloads ?? 'n/a'} | ${a.lastPublishedDate ?? 'n/a'} | ${a.monthsSinceLastPublish ?? 'n/a'} | ${a.nxVersionRange || 'n/a'} | ${majorsCol(a.compatibleNxMajors)} | ${a.githubStars ?? 'n/a'} | ${a.repoStatus} | ${a.reasons.join('; ')} |`
      );
    }
    lines.push('');
  };

  section('Abandoned', 'abandoned');
  section('Incompatible with current Nx', 'incompatible');
  section('Stale', 'stale');
  section('Healthy', 'healthy');

  return lines.join('\n');
}

async function main() {
  const allPlugins = JSON.parse(
    readFileSync(PLUGINS_FILE, 'utf-8')
  ) as CommunityPlugin[];
  const limit = process.env.LIMIT
    ? Number(process.env.LIMIT)
    : allPlugins.length;
  const plugins = allPlugins.slice(0, limit);

  console.log(`Assessing ${plugins.length} community plugins`);
  console.log(
    `Compat check against Nx majors: ${SUPPORTED_NX_MAJORS.join(', ')}`
  );

  const assessments: Assessment[] = [];
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];
    process.stdout.write(`[${i + 1}/${plugins.length}] ${plugin.name} ... `);

    const [npm, downloads] = await Promise.all([
      fetchNpmData(plugin.name),
      fetchNpmDownloads(plugin.name),
    ]);

    const parsed = parseGithubRepo(plugin.url);
    let gh: {
      stars: number | null;
      archived: boolean;
      status: Assessment['repoStatus'];
    } = { stars: null, archived: false, status: 'not_github' };

    if (parsed) {
      const info = fetchGithubRepo(parsed.owner, parsed.repo);
      gh = {
        stars: info.stars,
        archived: info.archived,
        status: info.status,
      };
    }

    const result = assess(
      plugin,
      npm,
      downloads,
      gh,
      parsed ? `${parsed.owner}/${parsed.repo}` : null
    );
    assessments.push(result);
    console.log(result.verdict);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = join(OUTPUT_DIR, 'community-plugins-assessment.json');
  const mdPath = join(OUTPUT_DIR, 'community-plugins-assessment.md');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        thresholds: THRESHOLDS,
        supportedNxMajors: SUPPORTED_NX_MAJORS,
        assessments,
      },
      null,
      2
    )
  );
  writeFileSync(mdPath, renderMarkdown(assessments));

  console.log('');
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);

  if (process.argv.includes('--prune')) {
    await prune(allPlugins, assessments);
  }
}

function prune(allPlugins: CommunityPlugin[], assessments: Assessment[]): void {
  const removeVerdicts = new Set<string>(['abandoned', 'incompatible']);
  const toRemove = new Set(
    assessments.filter((a) => removeVerdicts.has(a.verdict)).map((a) => a.name)
  );

  if (toRemove.size === 0) {
    console.log('No plugins to remove — all healthy or stale.');
    return;
  }

  const kept = allPlugins.filter((p) => !toRemove.has(p.name));
  const removed = assessments.filter((a) => toRemove.has(a.name));

  console.log(
    `\nRemoving ${toRemove.size} plugins (${kept.length} remaining):`
  );
  for (const a of removed) {
    console.log(`  - ${a.name} (${a.verdict}: ${a.reasons.join('; ')})`);
  }

  // Write updated plugins file
  writeFileSync(PLUGINS_FILE, JSON.stringify(kept, null, 2) + '\n');
  console.log(`\nUpdated ${PLUGINS_FILE}`);

  // Format with prettier
  const prettierResult = spawnSync(
    'npx',
    ['prettier', '--write', PLUGINS_FILE],
    { encoding: 'utf-8', cwd: REPO_ROOT }
  );
  if (prettierResult.status !== 0) {
    console.warn('prettier failed:', prettierResult.stderr);
  }

  // Create branch, commit, push, open PR
  const branch = `chore/prune-community-plugins-${new Date().toISOString().slice(0, 10)}`;
  const abandonedList = removed.filter((a) => a.verdict === 'abandoned');
  const incompatibleList = removed.filter((a) => a.verdict === 'incompatible');

  const prBody = [
    '## Summary',
    '',
    `Removes **${toRemove.size}** community plugins that no longer meet our listing criteria.`,
    '',
    '### Removal criteria',
    '',
    '- **Abandoned**: GitHub repo is 404, archived, or last published >24 months ago',
    `- **Incompatible**: declared Nx range does not include Nx ${SUPPORTED_NX_MAJORS.join(', ')}`,
    '',
    `### Abandoned (${abandonedList.length})`,
    '',
    ...abandonedList.map((a) => `- \`${a.name}\` — ${a.reasons.join('; ')}`),
    '',
    `### Incompatible (${incompatibleList.length})`,
    '',
    ...incompatibleList.map((a) => `- \`${a.name}\` — ${a.reasons.join('; ')}`),
    '',
    `### Kept (${kept.length} plugins remain)`,
    '',
    `Generated by \`npx tsx scripts/documentation/assess-community-plugins.ts --prune\``,
  ].join('\n');

  run('git', ['checkout', '-b', branch]);
  run('git', ['add', PLUGINS_FILE]);
  run('git', [
    'commit',
    '-m',
    `chore(repo): prune ${toRemove.size} unmaintained community plugins`,
  ]);
  run('git', ['push', '-u', 'origin', branch]);

  const prBodyFile = join(REPO_ROOT, 'tmp', 'prune-pr-body.md');
  writeFileSync(prBodyFile, prBody);
  run('gh', [
    'pr',
    'create',
    '--title',
    `chore(repo): prune ${toRemove.size} unmaintained community plugins`,
    '--body-file',
    prBodyFile,
    '--base',
    'master',
  ]);
}

function run(cmd: string, args: string[]): void {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
