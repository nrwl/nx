#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  exportSnapshot,
  makeWritableAndRemove,
  prepareArchiveSnapshot,
} from './snapshot.mjs';

const SKILL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
// The skill ships inside the repository it reviews, so the tooling it drives is
// addressed from the checkout rather than from the caller's working directory.
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const RUN_BASE = path.join(os.tmpdir(), 'nx-codex-pr-review');
const TRIAGE_DIR = path.resolve(
  process.env.NX_REVIEW_TRIAGE_DIR || path.join(os.homedir(), '.nx-pr-reviews')
);
const SANDBOX_CLI = path.join(REPO_ROOT, 'tools', 'review-sandbox', 'sandbox');
const SANDBOX_STATE_FILE = path.join(
  os.homedir(),
  '.nx-sandboxes',
  'sandboxes.json'
);
const BUILD_IMAGE = path.join(
  REPO_ROOT,
  'tools',
  'review-sandbox',
  'build-image.sh'
);
const IMAGE = process.env.SANDBOX_IMAGE || 'nx-review-sandbox:latest';
const MAX_BUFFER = 64 * 1024 * 1024;
const MIN_DOCKER_BYTES = 8 * 1024 * 1024 * 1024;
const STALE_RUN_MS = 24 * 60 * 60 * 1000;
const FETCH_RETRY_DELAYS_MS = [5_000, 20_000, 45_000];
const REQUIRED_LANES = [
  'implementation',
  'verification',
  'approach',
  'security',
];
const VERDICTS = {
  implementation: [
    'IMPLEMENTATION_BROKEN',
    'IMPLEMENTATION_CONCERN',
    'IMPLEMENTATION_SOUND',
  ],
  verification: [
    'VERIFICATION_BROKEN',
    'VERIFICATION_CONCERN',
    'VERIFICATION_SOUND',
  ],
  approach: [
    'APPROACH_SOUND',
    'BETTER_ALTERNATIVE_EXISTS',
    'APPROACH_INSUFFICIENT',
  ],
  security: ['SECURITY_VULNERABILITY', 'SECURITY_CONCERN', 'SECURITY_SOUND'],
  reproduce: [
    'REPRO_CONFIRMED',
    'REPRO_FAILED',
    'REPRO_INCONCLUSIVE',
    'REPRO_NOT_RUN',
  ],
};
const FINAL_VERDICTS = [
  'lgtm',
  'needs-changes',
  'blocked',
  'superseded',
  'unnecessary',
];
const PIPELINE_VERSION = 'review-pr-5';
class ReviewError extends Error {}

function fail(message) {
  throw new ReviewError(message);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) fail(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'force') {
      values.force = true;
      continue;
    }
    const value = argv[++index];
    if (value === undefined || value.startsWith('--'))
      fail(`missing value for --${key}`);
    values[key] = value;
  }
  return values;
}

function failRun(command, result) {
  const detail = (result.stderr || result.stdout || '')
    .trim()
    .split('\n')
    .slice(-20)
    .join('\n');
  fail(`${command} failed (${result.status})${detail ? `:\n${detail}` : ''}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    timeout: options.timeout || 300_000,
    cwd: options.cwd,
  });
  if (result.error) {
    if (result.error.code === 'ENOENT')
      fail(`missing required command: ${command}`);
    throw result.error;
  }
  if (!options.allowFailure && result.status !== 0) {
    failRun(command, result);
  }
  return result;
}

async function retryNonzero(
  operation,
  delaysMs,
  { wait = delay, onRetry = () => {} } = {}
) {
  let result = operation();
  for (const [index, delayMs] of delaysMs.entries()) {
    if (result.status === 0) return result;
    await onRetry(result, delayMs, index + 2, delaysMs.length + 1);
    await wait(delayMs);
    result = operation();
  }
  return result;
}

async function runGitFetchWithRetry(args) {
  const result = await retryNonzero(
    () => run('git', args, { allowFailure: true }),
    FETCH_RETRY_DELAYS_MS,
    {
      onRetry: (failed, delayMs, attempt, attempts) => {
        process.stderr.write(
          `git fetch failed (${failed.status}); retrying in ${delayMs / 1000}s ` +
            `(attempt ${attempt} of ${attempts})\n`
        );
      },
    }
  );
  if (result.status !== 0) {
    failRun('git', result);
  }
  return result;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertSha(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(value || ''))
    fail(`invalid ${label}: ${value || 'empty'}`);
  return value.toLowerCase();
}

async function atomicWrite(target, content, mode = 0o600) {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  );
  await writeFile(temporary, content, { mode });
  await rename(temporary, target);
}

async function atomicJson(target, value) {
  await atomicWrite(target, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveContainedPath(root, value, label = 'path') {
  let canonicalRoot;
  let canonicalValue;
  try {
    canonicalRoot = realpathSync(path.resolve(root));
    canonicalValue = realpathSync(path.resolve(value || ''));
  } catch (error) {
    fail(`cannot resolve ${label}: ${error.message}`);
  }
  const relative = path.relative(canonicalRoot, canonicalValue);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail(`${label} is outside ${root}`);
  }
  return canonicalValue;
}

function safeRunDir(value) {
  const resolved = path.resolve(value || '');
  return {
    resolved,
    canonical: resolveContainedPath(RUN_BASE, resolved, 'run directory'),
  };
}

async function loadRun(value) {
  const { resolved: runDir, canonical: canonicalRunDir } = safeRunDir(value);
  let state;
  try {
    state = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
  } catch (error) {
    fail(`cannot read run state: ${error.message}`);
  }
  let canonicalStateRunDir;
  try {
    canonicalStateRunDir = realpathSync(path.resolve(state.runDir || ''));
  } catch {
    fail('run state identity mismatch');
  }
  if (canonicalStateRunDir !== canonicalRunDir || state.version !== 1)
    fail('run state identity mismatch');
  // The sandbox CLI labels what it creates with this, and `prune` only reclaims
  // containers carrying its own label. Unset, a review would leave orphans that
  // no later run is allowed to sweep.
  process.env.SANDBOX_SESSION_ID = state.runId;
  return { runDir, canonicalRunDir, state };
}

async function saveRun(state) {
  await atomicJson(path.join(state.runDir, 'run.json'), state);
}

async function sweepStaleRuns() {
  await mkdir(RUN_BASE, { recursive: true, mode: 0o700 });
  const removed = [];
  const deferredSandbox = [];
  const retainedUnreadable = [];
  for (const name of await readdir(RUN_BASE)) {
    if (!/^pr-\d+-\d+-[0-9a-f]{8}$/.test(name)) continue;
    const target = path.join(RUN_BASE, name);
    let entry;
    try {
      entry = await lstat(target);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!entry.isDirectory() || Date.now() - entry.mtimeMs < STALE_RUN_MS)
      continue;
    const statePath = path.join(target, 'run.json');
    if (existsSync(statePath)) {
      try {
        const state = JSON.parse(await readFile(statePath, 'utf8'));
        if (state.sandbox?.id) {
          deferredSandbox.push(name);
          continue;
        }
      } catch {
        retainedUnreadable.push(name);
        continue;
      }
    }
    await makeWritableAndRemove(target);
    removed.push(name);
  }
  return { removed, deferredSandbox, retainedUnreadable };
}

async function staleSandboxRuns(currentRunDir) {
  if (!existsSync(RUN_BASE)) return [];
  const stale = [];
  for (const name of await readdir(RUN_BASE)) {
    if (!/^pr-\d+-\d+-[0-9a-f]{8}$/.test(name)) continue;
    const target = path.join(RUN_BASE, name);
    if (target === currentRunDir) continue;
    let entry;
    try {
      entry = await lstat(target);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!entry.isDirectory() || Date.now() - entry.mtimeMs < STALE_RUN_MS)
      continue;
    try {
      const state = JSON.parse(
        await readFile(path.join(target, 'run.json'), 'utf8')
      );
      if (state.runDir === target && state.sandbox?.id) {
        stale.push({ target, id: state.sandbox.id });
      }
    } catch {
      // Keep corrupt state for explicit inspection instead of guessing ownership.
    }
  }
  return stale;
}

function parsePrReference(value) {
  if (/^\d+$/.test(value)) return value;
  const match = value.match(
    /^https:\/\/github\.com\/nrwl\/nx\/pull\/(\d+)(?:[/?#].*)?$/
  );
  if (!match) fail('PR must be an nrwl/nx pull request URL or number');
  return match[1];
}

function mergeBaseFromCompare(value) {
  return assertSha(value?.merge_base_commit?.sha, 'merge-base SHA');
}

function diffFileCount(diff) {
  return (diff.match(/^diff --git /gm) || []).length;
}

function normalizePrFiles(pages) {
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) {
    fail('GitHub returned an invalid changed-files response');
  }
  return pages.flat().map((file) => ({
    path: file.filename,
    status: file.status,
    previous_path: file.previous_filename,
    additions: file.additions,
    deletions: file.deletions,
  }));
}

function prFilesArgs(pr) {
  // gh api rejects --slurp with --jq; normalize the slurped pages in JavaScript.
  return ['api', `repos/nrwl/nx/pulls/${pr}/files`, '--paginate', '--slurp'];
}

function resolveMergeBase(baseRef, headSha) {
  const result = run('gh', [
    'api',
    `repos/nrwl/nx/compare/${baseRef}...${headSha}`,
    '--jq',
    '.merge_base_commit.sha',
  ]);
  return assertSha(result.stdout.trim(), 'merge-base SHA');
}

function confirmPrIdentity(pr, metadata, mergeBase) {
  const confirmed = JSON.parse(
    run('gh', [
      'pr',
      'view',
      pr,
      '--repo',
      'nrwl/nx',
      '--json',
      'headRefOid,baseRefName',
    ]).stdout
  );
  const confirmedHead = assertSha(confirmed.headRefOid, 'confirmed head SHA');
  const confirmedMergeBase = resolveMergeBase(
    confirmed.baseRefName,
    confirmedHead
  );
  if (
    confirmedHead !== metadata.headRefOid ||
    confirmed.baseRefName !== metadata.baseRefName ||
    confirmedMergeBase !== mergeBase
  ) {
    fail('PR identity changed during acquisition; start a fresh review');
  }
}

function extractIssueNumbers(metadata) {
  const numbers = new Set(
    (metadata.closingIssuesReferences || [])
      .map((item) => Number(item.number))
      .filter(Boolean)
  );
  const text = [
    metadata.body || '',
    ...(metadata.commits || []).flatMap((commit) => [
      commit.messageHeadline || '',
      commit.messageBody || '',
    ]),
  ].join('\n');
  const pattern =
    /\b(?:fixe[sd]?|close[sd]?|resolve[sd]?)\s*:?(?:\s+nrwl\/nx)?#(\d+)\b/gi;
  for (const match of text.matchAll(pattern)) numbers.add(Number(match[1]));
  return [...numbers].sort((a, b) => a - b);
}

function extractLinearIds(metadata) {
  const text = [
    metadata.body || '',
    ...(metadata.commits || []).flatMap((commit) => [
      commit.messageHeadline || '',
      commit.messageBody || '',
    ]),
  ].join('\n');
  return [
    ...new Set(
      [...text.matchAll(/\bNXC-\d+\b/gi)].map((match) => match[0].toUpperCase())
    ),
  ].sort();
}

function renderPublicGrounding(metadata, issues) {
  const lines = [
    '# Public grounding',
    '',
    `## PR #${metadata.number}: ${metadata.title}`,
    '',
    metadata.body?.trim() || '(no PR body)',
  ];
  for (const issue of issues) {
    lines.push(
      '',
      `## Issue #${issue.number}: ${issue.title}`,
      '',
      issue.body?.trim() || '(no issue body)'
    );
    if (issue.comments?.length) {
      lines.push('', '### Public issue comments');
      for (const comment of issue.comments) {
        lines.push(
          '',
          `- ${comment.author?.login || 'unknown'} at ${comment.createdAt || 'unknown'}:`,
          '',
          comment.body || ''
        );
      }
    }
  }
  return `${lines.join('\n').trim()}\n`;
}

function canonicalPrUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function sessionMatchesPr(session, prUrl) {
  const expected = canonicalPrUrl(prUrl);
  return (
    Boolean(expected) &&
    Array.isArray(session?.pullRequests) &&
    session.pullRequests.some((pr) => canonicalPrUrl(pr?.url) === expected)
  );
}

async function cmdPolygraphContext(args) {
  if (!args.run) fail('usage: reviewctl.mjs polygraph-context --run <dir>');
  const { state } = await loadRun(args.run);
  const target = path.join(state.runDir, 'polygraph-context.json');
  await rm(target, { force: true });
  const unavailable = (reason) => {
    process.stdout.write(`${JSON.stringify({ available: false, reason })}\n`);
  };
  try {
    const auth = run('polygraph', ['whoami', '--json'], {
      allowFailure: true,
      timeout: 30_000,
    });
    if (auth.status !== 0) return unavailable('unavailable');
    const identity = JSON.parse(auth.stdout);
    if (!identity.loggedIn || !identity.selectedOrgId)
      return unavailable('unavailable');
    const search = run(
      'polygraph',
      [
        'session',
        'search',
        '--query',
        String(state.pr.number),
        '--limit',
        '10',
        '--json',
      ],
      { allowFailure: true, timeout: 60_000 }
    );
    if (search.status !== 0) return unavailable('unavailable');
    const parsed = JSON.parse(search.stdout);
    const candidates = Array.isArray(parsed) ? parsed : [];
    const matches = candidates
      .filter((session) => sessionMatchesPr(session, state.pr.url))
      .map((session) => ({
        sessionId: session.sessionId,
        title: session.title,
        author: session.author,
        status: session.status,
        pullRequests: session.pullRequests,
        description: session.description,
      }));
    if (!matches.length) return unavailable('no-match');
    await atomicJson(target, matches);
    process.stdout.write(
      `${JSON.stringify({ available: true, matches: matches.length, target })}\n`
    );
  } catch {
    unavailable('unavailable');
  }
}

async function cmdBegin(args) {
  if (!args.pr) fail('usage: reviewctl.mjs begin --pr <number-or-url>');
  const reclaimedRuns = await sweepStaleRuns();
  if (reclaimedRuns.removed.length) {
    process.stderr.write(
      `reclaimed ${reclaimedRuns.removed.length} abandoned review run(s): ${reclaimedRuns.removed.join(', ')}\n`
    );
  }
  if (reclaimedRuns.deferredSandbox.length) {
    process.stderr.write(
      `deferred ${reclaimedRuns.deferredSandbox.length} stale run(s) that own a sandbox until sandbox-up: ${reclaimedRuns.deferredSandbox.join(', ')}\n`
    );
  }
  if (reclaimedRuns.retainedUnreadable.length) {
    process.stderr.write(
      `retained ${reclaimedRuns.retainedUnreadable.length} stale run(s) with unreadable state for inspection: ${reclaimedRuns.retainedUnreadable.join(', ')}\n`
    );
  }
  run('gh', ['auth', 'status']);
  const pr = parsePrReference(args.pr);
  const fields = [
    'number',
    'title',
    'body',
    'author',
    'headRefOid',
    'headRefName',
    'baseRefName',
    'url',
    'isDraft',
    'additions',
    'deletions',
    'changedFiles',
    'createdAt',
    'mergeable',
    'mergeStateStatus',
    'commits',
    'closingIssuesReferences',
  ].join(',');
  const metadata = JSON.parse(
    run('gh', ['pr', 'view', pr, '--repo', 'nrwl/nx', '--json', fields]).stdout
  );
  metadata.headRefOid = assertSha(metadata.headRefOid, 'head SHA');
  const mergeBase = resolveMergeBase(metadata.baseRefName, metadata.headRefOid);
  if (!args.force) {
    const previous = await completedReviewForScope(metadata, mergeBase);
    if (previous) {
      confirmPrIdentity(pr, metadata, mergeBase);
      process.stdout.write(
        `${JSON.stringify({ alreadyReviewed: true, ...previous })}\n`
      );
      return;
    }
  }
  let diff;
  if (metadata.changedFiles <= 300) {
    const response = run('gh', ['pr', 'diff', pr, '--repo', 'nrwl/nx'], {
      allowFailure: true,
    });
    if (response.status === 0) diff = response.stdout;
    else if (!/PullRequest\.diff too_large/.test(response.stderr))
      failRun('gh', response);
  }
  const files = normalizePrFiles(JSON.parse(run('gh', prFilesArgs(pr)).stdout));
  if (files.length !== metadata.changedFiles) {
    fail(
      `changed-file count mismatch: metadata=${metadata.changedFiles}, files=${files.length}`
    );
  }

  const issueNumbers = extractIssueNumbers(metadata);
  const issues = [];
  const issueFailures = [];
  for (const issue of issueNumbers) {
    const response = run(
      'gh',
      [
        'issue',
        'view',
        String(issue),
        '--repo',
        'nrwl/nx',
        '--json',
        'number,title,body,comments,state,stateReason,labels,url,closedByPullRequestsReferences',
      ],
      { allowFailure: true }
    );
    if (response.status === 0) issues.push(JSON.parse(response.stdout));
    else issueFailures.push(issue);
  }

  confirmPrIdentity(pr, metadata, mergeBase);

  const runId = `pr-${metadata.number}-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const runDir = path.join(RUN_BASE, runId);
  await mkdir(runDir, { mode: 0o700 });
  const gitDir = path.join(runDir, 'repo.git');
  try {
    run('git', ['init', '--bare', gitDir]);
    await prepareArchiveSnapshot(gitDir);
    run('git', [
      '--git-dir',
      gitDir,
      'remote',
      'add',
      'origin',
      'https://github.com/nrwl/nx.git',
    ]);
    await runGitFetchWithRetry([
      '--git-dir',
      gitDir,
      'fetch',
      '--no-tags',
      '--depth=1',
      'origin',
      `pull/${metadata.number}/head:refs/review/head`,
    ]);
    await runGitFetchWithRetry([
      '--git-dir',
      gitDir,
      'fetch',
      '--no-tags',
      '--depth=1',
      'origin',
      `${mergeBase}:refs/review/base`,
    ]);
    const fetchedHead = assertSha(
      run('git', [
        '--git-dir',
        gitDir,
        'rev-parse',
        'refs/review/head',
      ]).stdout.trim(),
      'fetched head SHA'
    );
    const fetchedBase = assertSha(
      run('git', [
        '--git-dir',
        gitDir,
        'rev-parse',
        'refs/review/base',
      ]).stdout.trim(),
      'fetched merge-base SHA'
    );
    if (fetchedHead !== metadata.headRefOid || fetchedBase !== mergeBase) {
      fail('fetched Git identity does not match frozen PR identity');
    }

    if (diff === undefined) {
      diff = run('git', [
        '--git-dir',
        gitDir,
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--no-color',
        '--find-renames',
        '--ignore-submodules=none',
        mergeBase,
        metadata.headRefOid,
      ]).stdout;
    }
    if (metadata.changedFiles > 0 && !diff.trim())
      fail('empty diff for a non-empty PR');
    if (diffFileCount(diff) !== metadata.changedFiles) {
      fail(
        `diff file count mismatch: metadata=${metadata.changedFiles}, diff=${diffFileCount(diff)}`
      );
    }

    await atomicWrite(path.join(runDir, 'pr.diff'), diff);
    await atomicWrite(
      path.join(runDir, 'files.txt'),
      `${files.map((item) => item.path).join('\n')}\n`
    );
    await atomicJson(path.join(runDir, 'metadata.json'), {
      ...metadata,
      mergeBase,
      files,
      issues,
      issueFailures,
    });
    await atomicWrite(
      path.join(runDir, 'public-grounding.md'),
      renderPublicGrounding(metadata, issues)
    );
    const linearIds = extractLinearIds(metadata);
    await atomicWrite(
      path.join(runDir, 'private-context.md'),
      `Associated Linear tasks: ${linearIds.join(', ') || 'none'}\n`
    );
    await mkdir(path.join(runDir, 'lanes'), { mode: 0o700 });
    await mkdir(path.join(runDir, 'checks'), { mode: 0o700 });
    const headSnapshot = await exportSnapshot({
      gitDir,
      ref: 'refs/review/head',
      destination: path.join(runDir, 'head'),
      manifestPath: path.join(runDir, 'head-symlinks.json'),
    });
    const baseSnapshot = await exportSnapshot({
      gitDir,
      ref: 'refs/review/base',
      destination: path.join(runDir, 'base'),
      manifestPath: path.join(runDir, 'base-symlinks.json'),
    });
    await makeWritableAndRemove(gitDir);

    const state = {
      version: 1,
      pipeline: PIPELINE_VERSION,
      forceReview: Boolean(args.force),
      runId,
      runDir,
      createdAt: new Date().toISOString(),
      phase: 'begun',
      pr: {
        number: metadata.number,
        title: metadata.title,
        author: metadata.author?.login || 'unknown',
        url: metadata.url,
        headSha: metadata.headRefOid,
        headRef: metadata.headRefName,
        baseRef: metadata.baseRefName,
        mergeBase,
        isDraft: metadata.isDraft,
        additions: metadata.additions,
        deletions: metadata.deletions,
        changedFiles: metadata.changedFiles,
      },
      linearIds,
      issueFailures,
      paths: {
        diff: path.join(runDir, 'pr.diff'),
        files: path.join(runDir, 'files.txt'),
        metadata: path.join(runDir, 'metadata.json'),
        publicGrounding: path.join(runDir, 'public-grounding.md'),
        privateContext: path.join(runDir, 'private-context.md'),
        charter: path.join(runDir, 'charter.md'),
        head: path.join(runDir, 'head'),
        base: path.join(runDir, 'base'),
        headSymlinks: path.join(runDir, 'head-symlinks.json'),
        baseSymlinks: path.join(runDir, 'base-symlinks.json'),
      },
      hashes: { diff: sha256(diff) },
      snapshots: { head: headSnapshot, base: baseSnapshot },
      sandbox: null,
      triageDir: TRIAGE_DIR,
    };
    await saveRun(state);
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  } catch (error) {
    await makeWritableAndRemove(runDir);
    throw error;
  }
}

function parseDockerFree(output) {
  const lines = output.trim().split('\n').filter(Boolean);
  const fields = lines.at(-1)?.trim().split(/\s+/);
  const kib = Number(fields?.[3]);
  if (!Number.isSafeInteger(kib) || kib < 0)
    fail('could not parse Docker free space');
  return kib * 1024;
}

function dockerFreeBytes() {
  const capacity = run('docker', [
    'run',
    '--rm',
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    '32',
    '--memory',
    '64m',
    '--entrypoint',
    'df',
    IMAGE,
    '-Pk',
    '/',
  ]);
  return parseDockerFree(capacity.stdout);
}

function requireDockerCapacity() {
  const freeBytes = dockerFreeBytes();
  if (freeBytes < MIN_DOCKER_BYTES) {
    fail(
      `Docker has ${(freeBytes / 1024 ** 3).toFixed(1)} GiB free; 8 GiB is required. ` +
        'Inspect docker system df, prune rebuildable builder cache, or increase the Docker disk limit.'
    );
  }
  return freeBytes;
}

async function cmdSandboxUp(args) {
  const { state } = await loadRun(args.run);
  const staleRuns = await staleSandboxRuns(state.runDir);
  let pruneLog = '';
  for (const stale of staleRuns) {
    const stopped = run('node', [SANDBOX_CLI, 'stop', stale.id], {
      allowFailure: true,
    });
    pruneLog += `${stopped.stdout}${stopped.stderr}`;
  }
  const prune = run('node', [SANDBOX_CLI, 'prune'], { allowFailure: true });
  pruneLog += `${prune.stdout}${prune.stderr}`;
  await atomicWrite(path.join(state.runDir, 'sandbox-prune.log'), pruneLog);
  if (prune.status !== 0) fail('sandbox cleanup failed; see sandbox-prune.log');
  for (const stale of staleRuns) await makeWritableAndRemove(stale.target);
  if (state.sandbox?.id) {
    const listed = run('node', [SANDBOX_CLI, 'list'], { allowFailure: true });
    const live = listed.stdout
      .split('\n')
      .some((line) => line.trim().split(/\s+/)[0] === state.sandbox.id);
    if (listed.status === 0 && live) {
      process.stdout.write(`${JSON.stringify(state.sandbox, null, 2)}\n`);
      return;
    }
    state.sandbox = null;
    await saveRun(state);
  }
  // Build unconditionally: an image from any older revision passes an existence
  // check identically, so skipping on a hit hides a stale toolchain or a store
  // that no longer matches the lockfile. A no-op build costs ~1.5s (measured).
  const build = run('bash', [BUILD_IMAGE], {
    allowFailure: true,
    timeout: 3600_000,
  });
  await atomicWrite(
    path.join(state.runDir, 'image-build.log'),
    `${build.stdout}${build.stderr}`
  );
  if (build.status !== 0)
    fail('sandbox image build failed; see image-build.log');
  const freeBytes = requireDockerCapacity();
  const started = JSON.parse(
    run('node', [
      SANDBOX_CLI,
      'start',
      '--image',
      IMAGE,
      '--checkout',
      'https://github.com/nrwl/nx',
      '--ref',
      state.pr.headSha,
      '--base',
      state.pr.mergeBase,
      // This review starts a sandbox only to run checks in it, so a host with
      // no usable isolation must fail here rather than after the checkout.
      '--require-exec',
      '--json',
    ]).stdout
  );
  state.sandbox = {
    id: started.id,
    container: started.container,
    isolation: started.isolation,
    headSha: state.pr.headSha,
    baseSha: state.pr.mergeBase,
    freeBytes,
    install: 'pending',
  };
  state.phase = 'sandbox-started';
  await saveRun(state);

  const install = run('node', [SANDBOX_CLI, 'install', started.id], {
    allowFailure: true,
    timeout: 3600_000,
  });
  await atomicWrite(
    path.join(state.runDir, 'sandbox-install.log'),
    `${install.stdout}${install.stderr}`
  );
  const recordedInstall = await readSandboxInstallRecord(started.id, 'head');
  state.sandbox.install = classifySandboxInstall(
    install.status,
    recordedInstall
  );
  state.phase =
    state.sandbox.install === 'failed' ? 'sandbox-limited' : 'sandbox-ready';
  await saveRun(state);
  process.stdout.write(`${JSON.stringify(state.sandbox, null, 2)}\n`);
}

function normalizeEvidence(value) {
  const trimmed = value.trimEnd();
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/\\`/g, '`');
  }
  return trimmed;
}

function verifyEvidenceText({ diff, report, lane }) {
  if (!VERDICTS[lane]) fail(`unknown lane: ${lane}`);
  const reviewed = report.match(/^REVIEWED:\s*(\d+)\s*$/m);
  const lineMatch = report.match(/^EVIDENCE_LINE:\s*(\d+)\s*$/m);
  const textMatch = report.match(/^EVIDENCE_TEXT:\s*(.*)$/m);
  if (!reviewed || Number(reviewed[1]) < 1 || !lineMatch || !textMatch) {
    fail('lane report is missing a valid evidence preamble');
  }
  const number = Number(lineMatch[1]);
  const lines = diff.split('\n');
  const actual = lines[number - 1];
  const expected = normalizeEvidence(textMatch[1]);
  if (actual === undefined || actual.trimEnd() !== expected)
    fail('lane evidence does not match the frozen diff');
  const content = /^[+-]/.test(actual) && !/^(\+\+\+ |--- )/.test(actual);
  const metadata =
    /^(rename from |rename to |old mode |new mode |new file mode |deleted file mode |Binary files )/.test(
      actual
    );
  const diffHasContent = lines.some(
    (line) => /^[+-]/.test(line) && !/^(\+\+\+ |--- )/.test(line)
  );
  if (!content && !(metadata && !diffHasContent))
    fail('lane evidence is not a changed diff line');
  const verdict = VERDICTS[lane].find((token) =>
    new RegExp(`^\\*\\*Verdict:\\*\\*\\s*${token}\\s*$`, 'm').test(report)
  );
  if (!verdict) fail(`lane report is missing one allowed ${lane} verdict`);
  return { reviewed: Number(reviewed[1]), line: number, verdict };
}

async function cmdVerifyEvidence(args) {
  if (!args.run || !args.lane || !args.report) {
    fail(
      'usage: reviewctl.mjs verify-evidence --run <dir> --lane <lane> --report <file>'
    );
  }
  if (!VERDICTS[args.lane]) fail(`unknown lane: ${args.lane}`);
  const { canonicalRunDir, state } = await loadRun(args.run);
  const reportPath = resolveContainedPath(
    canonicalRunDir,
    args.report,
    'lane report'
  );
  const [diff, report] = await Promise.all([
    readFile(state.paths.diff, 'utf8'),
    readFile(reportPath, 'utf8'),
  ]);
  const attemptsDir = path.join(state.runDir, 'lane-attempts');
  await mkdir(attemptsDir, { recursive: true, mode: 0o700 });
  const ordinal =
    (await readdir(attemptsDir)).filter((name) =>
      name.startsWith(`${args.lane}-`)
    ).length + 1;
  await atomicWrite(
    path.join(attemptsDir, `${args.lane}-${ordinal}.md`),
    report
  );
  const result = verifyEvidenceText({ diff, report, lane: args.lane });
  const destination = path.join(state.runDir, 'lanes', `${args.lane}.md`);
  await atomicWrite(destination, report);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function parseFinalResult(content) {
  const limitationsMarker = '\n--- LIMITATIONS ---\n';
  const privateMarker = '\n--- PRIVATE REVIEW ---\n';
  const draftMarker = '\n--- REVIEW DRAFT ---\n';
  const limitationsIndex = content.indexOf(limitationsMarker);
  const privateIndex = content.indexOf(privateMarker);
  const draftIndex = content.indexOf(draftMarker);
  if (
    limitationsIndex < 0 ||
    privateIndex < limitationsIndex ||
    draftIndex < privateIndex
  ) {
    fail('final result markers are missing or out of order');
  }
  const header = content.slice(0, limitationsIndex).trim();
  const values = {};
  for (const line of header.split('\n')) {
    const match = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (!match) fail(`invalid final result header: ${line}`);
    values[match[1]] = match[2].trim();
  }
  const critical = Number(values.CRITICAL);
  const important = Number(values.IMPORTANT);
  if (!FINAL_VERDICTS.includes(values.VERDICT))
    fail(`invalid final verdict: ${values.VERDICT}`);
  if (
    !Number.isSafeInteger(critical) ||
    critical < 0 ||
    !Number.isSafeInteger(important) ||
    important < 0
  ) {
    fail('invalid final severity counts');
  }
  if (!['review', 're-review'].includes(values.REVIEW_KIND))
    fail('invalid REVIEW_KIND');
  const limitations = content
    .slice(limitationsIndex + limitationsMarker.length, privateIndex)
    .trim();
  if (
    limitations !== 'none' &&
    (!limitations ||
      limitations.split('\n').some((line) => line && !line.startsWith('- ')))
  ) {
    fail(
      "LIMITATIONS must be 'none' or one top-level Markdown bullet per line"
    );
  }
  const privateReview = content
    .slice(privateIndex + privateMarker.length, draftIndex)
    .trim();
  const draft = content.slice(draftIndex + draftMarker.length).trim();
  if (!privateReview) fail('PRIVATE REVIEW must not be empty');
  if (!draft) fail('REVIEW DRAFT must not be empty');
  return {
    verdict: values.VERDICT,
    critical,
    important,
    reviewKind: values.REVIEW_KIND,
    linearTarget: values.LINEAR_TARGET || 'none',
    limitations,
    privateReview,
    draft,
  };
}

function proseIndices(lines) {
  let fence = null;
  const indices = [];
  lines.forEach((line, index) => {
    const match = line.trimStart().match(/^(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        match &&
        match[1][0] === fence[0] &&
        match[1].length >= fence.length &&
        !match[2].trim()
      ) {
        fence = null;
      }
      return;
    }
    if (match && !(match[1][0] === '`' && match[2].includes('`'))) {
      fence = match[1];
      return;
    }
    indices.push(index);
  });
  return indices;
}

function proseLines(content) {
  const lines = content.split('\n');
  return proseIndices(lines).map((index) => lines[index]);
}

function extractSection(content, heading, level = 2) {
  const prefix = '#'.repeat(level);
  const marker = `${prefix} ${heading}`;
  const lines = content.split('\n');
  // Headings are found among prose lines, so a fenced one cannot open a section.
  // The body is sliced from the original lines, keeping its fenced blocks.
  const prose = proseIndices(lines);
  const headings = prose.filter((index) => lines[index].trimEnd() === marker);
  if (headings.length > 1) fail(`duplicate ${heading} section`);
  if (!headings.length) return '';
  const start = headings[0];
  const next = prose.find(
    (index) => index > start && lines[index].trimEnd().startsWith(`${prefix} `)
  );
  return lines
    .slice(start + 1, next === undefined ? undefined : next)
    .join('\n')
    .trim();
}

function classifySandboxInstall(processStatus, recordedStatus) {
  if (processStatus !== 0) return 'failed';
  if (recordedStatus === 'OK') return 'ok';
  if (recordedStatus === 'OK_UNPINNED') return 'unpinned';
  return 'unknown';
}

function sandboxInstallRecord(sandboxState, id, label) {
  return sandboxState?.sandboxes?.[id]?.installed?.[label] || null;
}

async function readSandboxInstallRecord(id, label) {
  try {
    const sandboxState = JSON.parse(await readFile(SANDBOX_STATE_FILE, 'utf8'));
    return sandboxInstallRecord(sandboxState, id, label);
  } catch {
    return null;
  }
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---\n', 4);
  if (end < 0) return {};
  const values = {};
  for (const line of content.slice(4, end).split('\n')) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return values;
}

function matchesCompletedReview(metadata, scope) {
  const attempt = Number(metadata.attempt);
  return (
    metadata.head_sha === scope.headSha &&
    metadata.base_ref === scope.baseRef &&
    metadata.merge_base === scope.mergeBase &&
    metadata.pipeline_version === PIPELINE_VERSION &&
    metadata.review_path === 'full' &&
    FINAL_VERDICTS.includes(metadata.verdict) &&
    Number.isSafeInteger(attempt) &&
    attempt > 0
  );
}

async function completedReviewForScope(metadata, mergeBase) {
  const triage = path.join(TRIAGE_DIR, `${metadata.number}.md`);
  if (!existsSync(triage)) return null;
  const previous = parseFrontmatter(await readFile(triage, 'utf8'));
  if (
    !matchesCompletedReview(previous, {
      headSha: metadata.headRefOid,
      baseRef: metadata.baseRefName,
      mergeBase,
    })
  ) {
    return null;
  }
  return {
    verdict: previous.verdict,
    attempt: Number(previous.attempt),
    triage,
    headSha: metadata.headRefOid,
    mergeBase,
    pipelineVersion: PIPELINE_VERSION,
  };
}

async function matchingPublishedArtifact(state, triagePath) {
  if (!existsSync(triagePath)) return null;
  const metadata = parseFrontmatter(await readFile(triagePath, 'utf8'));
  return metadata.run_id === state.runId ? metadata : null;
}

function sectionFindingCount(content, heading, sectionLevel, findingLevel) {
  const body = extractSection(content, heading, sectionLevel);
  if (!body) return 0;
  // The body keeps its fenced blocks for history, so count prose headings only.
  const marker = new RegExp(`^${'#'.repeat(findingLevel)}\\s+`);
  return proseLines(body).filter((line) => marker.test(line)).length;
}

function validateDraft(result) {
  const draft = result.draft;
  if (!draft.startsWith('### '))
    fail('the review draft must start with a level-3 section heading');
  if (proseLines(draft).some((line) => /^#{1,2} /.test(line)))
    fail('the review draft cannot contain a level-1 or level-2 heading');
  if (
    /^### (?:Validation|Verification|Reproduction verification)\s*$/im.test(
      draft
    )
  ) {
    fail('the review draft contains a forbidden process section');
  }
  if (sectionFindingCount(draft, 'Critical', 3, 4) !== result.critical)
    fail('the review draft Critical count does not match the final result');
  if (sectionFindingCount(draft, 'Important', 3, 4) !== result.important)
    fail('the review draft Important count does not match the final result');
  if (
    result.critical > 0 &&
    !['needs-changes', 'superseded', 'unnecessary'].includes(result.verdict)
  )
    fail(
      'a Critical finding requires needs-changes, superseded, or unnecessary'
    );
  if (result.critical === 0 && result.verdict === 'needs-changes')
    fail('needs-changes requires a Critical finding');
  const continuityHeading = proseLines(draft).some(
    (line) => line.trimEnd() === '### Since previous review'
  );
  if (result.reviewKind === 'review' && continuityHeading)
    fail('a first review cannot include continuity');
  if (
    result.reviewKind === 're-review' &&
    !extractSection(draft, 'Since previous review', 3)
  )
    fail('a re-review requires a non-empty Since previous review section');
  if (
    result.verdict === 'blocked' &&
    !/^### (?:Questions for the author|Maintainer calls)\s*$/m.test(draft)
  ) {
    fail(
      'a blocked review draft must state the unresolved question or maintainer call'
    );
  }
}

function validateReviewPath(
  state,
  result,
  { laneReports = [], laneAttempts = [] } = {}
) {
  if (laneReports.length) return 'full';
  if (laneAttempts.length)
    fail('reviewer attempts exist; the full reviewer wave is required');
  if (state.forceReview)
    fail('a forced review cannot use the closeability-only path');
  if (!['superseded', 'unnecessary'].includes(result.verdict))
    fail('the closeability-only path requires superseded or unnecessary');
  if (result.critical !== 0 || result.important !== 0)
    fail('the closeability-only path cannot contain findings');
  if (!/^### Close-without-merge check\s*$/m.test(result.draft))
    fail(
      'the closeability-only draft requires a Close-without-merge check section'
    );
  return 'closeability';
}

async function liveIdentity(state) {
  const live = JSON.parse(
    run('gh', [
      'pr',
      'view',
      String(state.pr.number),
      '--repo',
      'nrwl/nx',
      '--json',
      'headRefOid,baseRefName',
    ]).stdout
  );
  const head = assertSha(live.headRefOid, 'live head SHA');
  const mergeBase = resolveMergeBase(live.baseRefName, head);
  if (
    head !== state.pr.headSha ||
    live.baseRefName !== state.pr.baseRef ||
    mergeBase !== state.pr.mergeBase
  ) {
    fail(
      'PR identity changed during review; discard this attempt and review the new scope'
    );
  }
}

async function readDirectoryReports(directory) {
  if (!existsSync(directory)) return [];
  const reports = [];
  for (const name of (await readdir(directory)).sort()) {
    const target = path.join(directory, name);
    if ((await stat(target)).isFile())
      reports.push({ name, content: await readFile(target, 'utf8') });
  }
  return reports;
}

function renderFailureRecord({
  state,
  reason,
  laneReports,
  laneAttempts,
  checks,
}) {
  const verifiedByLane = new Map(
    laneReports.map((report) => [
      report.name.replace(/\.md$/, ''),
      report.content,
    ])
  );
  const uniqueAttempts = laneAttempts.filter((attempt) => {
    const match = attempt.name.match(/^(.+)-\d+\.md$/);
    return !match || verifiedByLane.get(match[1]) !== attempt.content;
  });
  const renderReports = (reports) =>
    reports.length
      ? reports
          .map((item) => `### ${item.name}\n\n${item.content.trim()}`)
          .join('\n\n')
      : 'none';
  const verificationInputs = uniqueAttempts.length
    ? `\n\n## Lane verification inputs\n\n${renderReports(uniqueAttempts)}`
    : '';
  return (
    `# Failed review attempt for PR #${state.pr.number}\n\n` +
    `- HEAD: \`${state.pr.headSha}\`\n` +
    `- Merge base: \`${state.pr.mergeBase}\`\n` +
    `- Diff SHA-256: \`${state.hashes.diff}\`\n` +
    `- Run: \`${state.runId}\`\n\n` +
    `## Reason\n\n${reason.trim()}\n\n` +
    `## Verified lane reports\n\n${renderReports(laneReports)}` +
    verificationInputs +
    `\n\n## Parent-run checks\n\n${renderReports(checks)}\n`
  );
}

async function cleanupSandbox(state) {
  if (!state.sandbox?.id) return null;
  const result = run('node', [SANDBOX_CLI, 'stop', state.sandbox.id], {
    allowFailure: true,
  });
  if (result.status === 0) {
    state.sandbox = null;
    return null;
  }
  // `stop` drops the registry row before reporting a reclaim failure, which is
  // what makes this retry possible: `prune` sweeps a review subtree no row
  // references any more. It cannot prove this review's subtree was the one
  // swept, so the warning still names it rather than claiming a clean exit.
  run('node', [SANDBOX_CLI, 'prune'], { allowFailure: true });
  const detail = (result.stderr || result.stdout || '')
    .trim()
    .split('\n')
    .at(-1);
  const where = state.sandbox.container
    ? ` in shared host ${state.sandbox.container}`
    : '';
  return (
    `sandbox cleanup failed for ${state.sandbox.id}${where}${detail ? `: ${detail}` : ''}. ` +
    'Run `tools/review-sandbox/sandbox prune` to sweep it.'
  );
}

async function cleanupRun(state) {
  const warnings = [];
  try {
    const warning = await cleanupSandbox(state);
    if (warning) warnings.push(warning);
  } catch (error) {
    warnings.push(`sandbox cleanup failed: ${error.message}`);
  }
  try {
    await makeWritableAndRemove(state.runDir);
  } catch (error) {
    warnings.push(`temporary run cleanup failed: ${error.message}`);
  }
  return warnings;
}

async function writeArtifactsAtomic(artifacts) {
  if (!artifacts.length) return;
  for (const directory of new Set(
    artifacts.map(({ target }) => path.dirname(target))
  )) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }
  const suffix = `${process.pid}.${randomBytes(4).toString('hex')}`;
  const staged = artifacts.map(({ target, content }) => ({
    target,
    content,
    next: `${target}.${suffix}.new`,
    old: `${target}.${suffix}.old`,
    hadTarget: false,
    installed: false,
  }));
  try {
    for (const file of staged) {
      await writeFile(file.next, file.content, { mode: 0o600 });
    }
  } catch (error) {
    for (const file of staged) {
      await rm(file.next, { force: true });
    }
    throw error;
  }
  try {
    for (const file of staged) {
      if (!existsSync(file.target)) continue;
      await rename(file.target, file.old);
      file.hadTarget = true;
    }
    for (const file of staged) {
      await rename(file.next, file.target);
      file.installed = true;
    }
  } catch (error) {
    for (const file of staged) {
      if (file.installed) await rm(file.target, { force: true });
    }
    for (const file of staged) {
      if (file.hadTarget && existsSync(file.old)) {
        await rename(file.old, file.target);
      }
    }
    throw error;
  } finally {
    for (const file of staged) {
      await rm(file.next, { force: true });
    }
  }
  for (const file of staged) {
    await rm(file.old, { force: true });
  }
}

async function archivePrevious(state, previous, previousMeta, triagePath) {
  if (!previous) return;
  const attempt = Number(previousMeta.attempt) || 0;
  const head = (previousMeta.head_sha || 'unknown').slice(0, 12);
  // Dot-prefixed so the shared review directory keeps listing drafts alone:
  // Claude's outbox reads it with a plain `ls` and parses each entry.
  const history = path.join(
    state.triageDir,
    '.history',
    String(state.pr.number)
  );
  await mkdir(history, { recursive: true, mode: 0o700 });
  await copyFile(
    triagePath,
    path.join(history, `attempt-${attempt}-${head}.md`)
  );
}

function priorReviewsSection(previous, previousMeta) {
  const entries = [];
  const draft = extractSection(previous, 'Review draft');
  if (draft) {
    const attempt = Number(previousMeta.attempt) || 0;
    const head = previousMeta.head_sha || 'unknown';
    const date = previousMeta.last_reviewed_at || 'unknown';
    // The grill belongs to the draft it evaluated, so it is demoted with it. A
    // top-level `## Grill` would tell the outbox a human had already evaluated
    // the new draft, and `post all` would publish fresh findings ungrilled.
    const grill = extractSection(previous, 'Grill');
    entries.push(
      `### attempt ${attempt} - head_sha=${head} - ${date}\n\n${draft}` +
        (grill ? `\n\n**Grill (attempt ${attempt}):**\n\n${grill}` : '')
    );
  }
  const earlier = extractSection(previous, 'Prior reviews');
  if (earlier && earlier !== 'none') entries.push(earlier);
  return entries.join('\n\n') || 'none';
}

// A posted attempt is demoted into history here, so its URL has to survive the
// frontmatter reset that makes the new draft pending again.
function postedSection(previous, previousMeta) {
  const recorded = extractSection(previous, 'Posted');
  const body = recorded === '(none yet)' ? '' : recorded;
  const at = previousMeta.posted_at;
  if (!at) return body || '(none yet)';
  const url = previousMeta.posted_url || 'unknown URL';
  if (body.includes(url) || body.includes(at)) return body;
  const attempt = Number(previousMeta.attempt) || 0;
  const verdict = previousMeta.verdict || 'unknown';
  return [body, `- attempt ${attempt} posted ${at} as ${verdict} -> ${url}`]
    .filter(Boolean)
    .join('\n');
}

// Sections the maintainer owns: rewriting them would discard their own notes.
function carriedSection(previous, heading) {
  const body = extractSection(previous, heading);
  return body ? `\n## ${heading}\n\n${body}\n` : '';
}

// Embedded external text is fenced past its own longest backtick run so it
// cannot open a record section: the outbox reads `## Grill` as human evaluation.
function inertBlock(text, info) {
  const runs = [...text.matchAll(/^\s*(`{3,})/gm)].map(
    (match) => match[1].length + 1
  );
  const fence = '`'.repeat(Math.max(3, ...runs));
  return `${fence}${info}\n${text}\n${fence}`;
}

async function composeTriage(state, result, triagePath) {
  const previous = existsSync(triagePath)
    ? await readFile(triagePath, 'utf8')
    : '';
  const previousMeta = parseFrontmatter(previous);
  const attempt = (Number(previousMeta.attempt) || 0) + 1;
  const [publicGrounding, privateContext, laneReports, checks] =
    await Promise.all([
      readFile(state.paths.publicGrounding, 'utf8'),
      readFile(state.paths.privateContext, 'utf8'),
      readDirectoryReports(path.join(state.runDir, 'lanes')),
      readDirectoryReports(path.join(state.runDir, 'checks')),
    ]);
  const lanes = laneReports
    .map((item) => `### ${item.name}\n\n${item.content.trim()}`)
    .join('\n\n');
  const laneText =
    lanes ||
    (result.reviewPath === 'closeability'
      ? 'Not run because current public evidence established a close-without-merge outcome.'
      : 'none');
  const checkText = checks.length
    ? checks
        .map(
          (item) =>
            `### ${item.name}\n\n${inertBlock(item.content.trim(), 'text')}`
        )
        .join('\n\n')
    : 'none';
  const limitations =
    result.limitations === 'none' ? [] : result.limitations.split('\n');
  if (state.sandbox?.install === 'failed') {
    limitations.push(
      '- Sandbox dependency installation failed; runtime evidence was unavailable.'
    );
  } else if (state.sandbox?.install === 'unpinned') {
    limitations.push(
      '- Sandbox dependencies installed only without --frozen-lockfile; resolved versions were not pinned.'
    );
  } else if (state.sandbox?.install === 'unknown') {
    limitations.push(
      '- Sandbox dependency installation completed, but its pinned or unpinned provenance could not be read.'
    );
  }
  const baseInstall = state.sandbox?.id
    ? await readSandboxInstallRecord(state.sandbox.id, 'base')
    : null;
  if (baseInstall === 'OK_UNPINNED') {
    limitations.push(
      '- Base sandbox dependencies installed only without --frozen-lockfile; resolved versions were not pinned.'
    );
  } else if (baseInstall === 'FAILED') {
    limitations.push(
      '- Base sandbox dependency installation failed; paired runtime evidence may reflect missing dependencies.'
    );
  }
  for (const issue of state.issueFailures || []) {
    limitations.push(`- Linked public issue #${issue} could not be acquired.`);
  }
  const limitationText = limitations.length
    ? limitations.join('\n')
    : 'none recorded';
  const now = new Date().toISOString();
  const triage = `---
pr: ${state.pr.number}
title: ${JSON.stringify(state.pr.title)}
author: ${JSON.stringify(state.pr.author)}
url: ${JSON.stringify(state.pr.url)}
head_sha: ${state.pr.headSha}
base_ref: ${JSON.stringify(state.pr.baseRef)}
merge_base: ${state.pr.mergeBase}
last_reviewed_at: ${now}
verdict: ${result.verdict}
attempt: ${attempt}
reviewer: codex
pipeline_version: ${state.pipeline}
review_path: ${result.reviewPath}
run_id: ${state.runId}
linear_target: ${JSON.stringify(result.linearTarget)}
posted_at:
posted_url:
---

# PR #${state.pr.number}: ${state.pr.title}

${state.pr.author}: ${state.pr.additions}+/${state.pr.deletions}- across ${state.pr.changedFiles} files
HEAD: \`${state.pr.headSha}\`; merge base: \`${state.pr.mergeBase}\`

## Review draft

${result.draft}

## Prior reviews

${priorReviewsSection(previous, previousMeta)}
${carriedSection(previous, 'Author follow-ups (not for the PR)')}
## Private review

${result.privateReview}

## Frozen scope

- Diff SHA-256: \`${state.hashes.diff}\`
- HEAD snapshot: ${state.snapshots.head.files} files, ${state.snapshots.head.bytes} bytes
- Base snapshot: ${state.snapshots.base.files} files, ${state.snapshots.base.bytes} bytes

## Lane reports

${laneText}

## Parent-run checks

${checkText}

## Public grounding

${inertBlock(publicGrounding.trim(), 'markdown')}

## Private context

${inertBlock(privateContext.trim(), 'markdown')}

## Posted

${postedSection(previous, previousMeta)}

## Failures

${limitationText}
`;
  return { triage, attempt, previous, previousMeta };
}

async function recordFailure(state, reason) {
  const failureDir = path.join(
    state.triageDir,
    '.failures',
    String(state.pr.number)
  );
  await mkdir(failureDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(
    failureDir,
    `${stamp}-${state.pr.headSha.slice(0, 12)}.md`
  );
  const [laneReports, laneAttempts, checks] = await Promise.all([
    readDirectoryReports(path.join(state.runDir, 'lanes')),
    readDirectoryReports(path.join(state.runDir, 'lane-attempts')),
    readDirectoryReports(path.join(state.runDir, 'checks')),
  ]);
  await atomicWrite(
    target,
    renderFailureRecord({
      state,
      reason,
      laneReports,
      laneAttempts,
      checks,
    })
  );
  return target;
}

async function cmdFinalize(args) {
  if (!args.run || !args.result)
    fail('usage: reviewctl.mjs finalize --run <dir> --result <file>');
  const { canonicalRunDir, state } = await loadRun(args.run);
  const triagePath = path.join(state.triageDir, `${state.pr.number}.md`);
  const published = await matchingPublishedArtifact(state, triagePath);
  if (
    published &&
    FINAL_VERDICTS.includes(published.verdict) &&
    Number.isSafeInteger(Number(published.attempt))
  ) {
    const cleanupWarnings = [];
    state.phase = 'published';
    try {
      await saveRun(state);
    } catch (error) {
      cleanupWarnings.push(
        `run state update failed after publication: ${error.message}`
      );
    }
    cleanupWarnings.push(...(await cleanupRun(state)));
    process.stdout.write(
      `${JSON.stringify({ verdict: published.verdict, triage: triagePath, attempt: Number(published.attempt), alreadyPublished: true, cleanupWarnings })}\n`
    );
    return;
  }
  if (state.phase === 'published') {
    fail(
      'review artifacts were already published; run abort to clean the leftover run state'
    );
  }
  const resultPath = resolveContainedPath(
    canonicalRunDir,
    args.result,
    'final result'
  );
  const result = parseFinalResult(await readFile(resultPath, 'utf8'));
  validateDraft(result);
  const [laneReports, laneAttempts] = await Promise.all([
    readDirectoryReports(path.join(state.runDir, 'lanes')),
    readDirectoryReports(path.join(state.runDir, 'lane-attempts')),
  ]);
  result.reviewPath = validateReviewPath(state, result, {
    laneReports,
    laneAttempts,
  });
  if (result.reviewPath === 'full') {
    const diff = await readFile(state.paths.diff, 'utf8');
    for (const lane of REQUIRED_LANES) {
      const reportPath = path.join(state.runDir, 'lanes', `${lane}.md`);
      if (!existsSync(reportPath))
        fail(`required lane is not verified: ${lane}`);
      try {
        verifyEvidenceText({
          diff,
          report: await readFile(reportPath, 'utf8'),
          lane,
        });
      } catch (error) {
        fail(
          `required lane report no longer verifies: ${lane}: ${error.message}`
        );
      }
    }
  }
  await liveIdentity(state);
  const composed = await composeTriage(state, result, triagePath);
  await archivePrevious(
    state,
    composed.previous,
    composed.previousMeta,
    triagePath
  );
  await writeArtifactsAtomic([
    { target: triagePath, content: composed.triage },
  ]);
  const cleanupWarnings = [];
  state.phase = 'published';
  try {
    await saveRun(state);
  } catch (error) {
    cleanupWarnings.push(
      `run state update failed after publication: ${error.message}`
    );
  }
  cleanupWarnings.push(...(await cleanupRun(state)));
  process.stdout.write(
    `${JSON.stringify({ verdict: result.verdict, triage: triagePath, attempt: composed.attempt, cleanupWarnings })}\n`
  );
}

async function cmdAbort(args) {
  if (!args.run || !args['reason-file']) {
    fail('usage: reviewctl.mjs abort --run <dir> --reason-file <file>');
  }
  const { state } = await loadRun(args.run);
  const reason = await readFile(path.resolve(args['reason-file']), 'utf8');
  const triagePath = path.join(state.triageDir, `${state.pr.number}.md`);
  const published =
    state.phase === 'published' ||
    Boolean(await matchingPublishedArtifact(state, triagePath));
  let failure = null;
  let failureError = null;
  if (!published) {
    try {
      failure = await recordFailure(state, reason);
    } catch (error) {
      failureError = error.message;
    }
  }
  if (!published && failureError) {
    const details = [
      `failure record unavailable: ${failureError}`,
      `run retained: ${state.runDir}`,
    ];
    try {
      const warning = await cleanupSandbox(state);
      if (warning) details.push(warning);
    } catch (error) {
      details.push(`sandbox cleanup failed: ${error.message}`);
    }
    if (!state.sandbox?.id) {
      try {
        await saveRun(state);
      } catch (error) {
        details.push(`run state update failed: ${error.message}`);
      }
    }
    process.stderr.write(`review abort incomplete; ${details.join('; ')}\n`);
    process.exitCode = 1;
    return;
  }
  const cleanupWarnings = await cleanupRun(state);
  if (published) {
    const warningText = cleanupWarnings.length
      ? `; ${cleanupWarnings.join('; ')}`
      : '';
    process.stdout.write(
      `published review already recorded; leftover run state cleaned${warningText}\n`
    );
    return;
  }
  const details = [`failure record: ${failure}`, ...cleanupWarnings];
  process.stderr.write(`review aborted; ${details.join('; ')}\n`);
  process.exitCode = 1;
}

const COMMANDS = {
  begin: cmdBegin,
  'polygraph-context': cmdPolygraphContext,
  'sandbox-up': cmdSandboxUp,
  'verify-evidence': cmdVerifyEvidence,
  finalize: cmdFinalize,
  abort: cmdAbort,
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || !COMMANDS[command]) {
    process.stderr.write(
      'usage: reviewctl.mjs <begin|polygraph-context|sandbox-up|verify-evidence|finalize|abort> [options]\n'
    );
    process.exitCode = 2;
    return;
  }
  try {
    await COMMANDS[command](parseArgs(rest));
  } catch (error) {
    process.stderr.write(`reviewctl: ${error.message}\n`);
    process.exitCode = 1;
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(path.resolve(process.argv[1]))
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  await main();
}
