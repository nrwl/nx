/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */
import { relative } from 'node:path';
import { minimatch } from 'minimatch';
import { interpolate } from '../../../tasks-runner/utils';
import { workspaceRoot } from '../../../utils/workspace-root';
import { execCommand } from './exec-command';

export interface GitCommitAuthor {
  name: string;
  email: string;
}

export interface RawGitCommit {
  message: string;
  body: string;
  shortHash: string;
  author: GitCommitAuthor;
}

export interface Reference {
  type: 'hash' | 'issue' | 'pull-request';
  value: string;
}

export interface GitTagAndVersion {
  tag: string;
  extractedVersion: string;
}

export interface GitCommit extends RawGitCommit {
  description: string;
  type: string;
  scope: string;
  references: Reference[];
  authors: GitCommitAuthor[];
  isBreaking: boolean;
  affectedFiles: string[];
  revertedHashes: string[];
}

function escapeRegExp(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/g;

/**
 * Check if a semver string is for a stable release (i.e. no prerelease or build metadata)
 * @param semver - The semver string to check
 * @returns True if the semver string is stable, false otherwise
 */
export function isStableSemver(semver: string): boolean {
  const semverMatch = new RegExp(SEMVER_REGEX).exec(semver);
  if (!semverMatch) return false;
  
  // Check that we have major, minor, patch but no prerelease or build metadata
  const [, , , , prerelease, buildMetadata] = semverMatch;
  return !prerelease && !buildMetadata;
}

/**
 * Extract the tag and version from a tag string
 * 
 * @param tag - The tag string to extract the tag and version from
 * @param tagRegexp - The regex to use to extract the tag and version from the tag string
 * 
 * @returns The tag and version
 */
export function extractTagAndVersion(tag: string, tagRegexp: string): GitTagAndVersion {
  const [latestMatchingTag, ...rest] = tag.match(tagRegexp);
  const version = rest.filter((r) => {
    return r.match(SEMVER_REGEX);
  })[0] ?? null;

  return {
    tag: latestMatchingTag,
    extractedVersion: version,
  };
}

/**
 * Get the latest git tag for the configured release tag pattern.
 * 
 * This function will:
 * - Get all tags from the git repo, sorted by version
 * - Filter the tags into a list with SEMVER-compliant tags, matching the release tag pattern
 * - If a preid is provided, prioritise tags for that preid, then semver tags without a preid
 * - If no preid is provided, search only for stable semver tags (i.e. no pre-release or build metadata)
 * 
 * @param releaseTagPattern - The pattern to filter the tags list by
 * @param additionalInterpolationData - Additional data used when interpolating the release tag pattern
 * @param options - The options to use when getting the latest git tag for the pattern
 * 
 * @returns The tag and version
 */
export async function getLatestGitTagForPattern(
  releaseTagPattern: string,
  additionalInterpolationData = {},
  options: {
    checkAllBranchesWhen?: boolean | string[],
    preId?: string
  } = {}
): Promise<GitTagAndVersion | null> {
  const { checkAllBranchesWhen = false, preId = '' } = options;

  /**
   * By default, we will try and resolve the latest match for the releaseTagPattern from the current branch,
   * falling back to all branches if no match is found on the current branch.
   *
   * - If checkAllBranchesWhen is true it will cause us to ALWAYS check all branches for the latest match.
   * - If checkAllBranchesWhen is explicitly set to false it will cause us to ONLY check the current branch for the latest match.
   * - If checkAllBranchesWhen is an array of strings it will cause us to check all branches WHEN the current branch is one of the strings in the array.
   */
  let alwaysCheckAllBranches = false;
  if (typeof checkAllBranchesWhen !== 'undefined') {
    if (typeof checkAllBranchesWhen === 'boolean') {
      alwaysCheckAllBranches = checkAllBranchesWhen;
    } else if (Array.isArray(checkAllBranchesWhen)) {
      /**
       * Get the current git branch and determine whether to check all branches based on the checkAllBranchesWhen parameter
       */
      const currentBranch = await execCommand('git', [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]).then((r) => r.trim());
      // Check exact match first
      alwaysCheckAllBranches = checkAllBranchesWhen.includes(currentBranch);
      // Check if any glob pattern matches next
      if (!alwaysCheckAllBranches) {
        alwaysCheckAllBranches = checkAllBranchesWhen.some((pattern) => {
          const r = minimatch.makeRe(pattern, { dot: true });
          if (!r) {
            return false;
          }
          return r.test(currentBranch);
        });
      }
    }
  }

  const defaultGitArgs = [
    // Apply git config to take version suffixes into account when sorting, e.g. 1.0.0 is newer than 1.0.0-beta.1
    '-c',
    'versionsort.suffix=-',
    'tag',
    '--sort',
    '-v:refname',
  ];

  try {
    let tags: string[];
    tags = await execCommand('git', [
      ...defaultGitArgs,
      ...(alwaysCheckAllBranches ? [] : ['--merged']),
    ]).then((r) =>
      r
        .trim()
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
    );

    if (
      // Do not run this fallback if the user explicitly set checkAllBranchesWhen to false
      checkAllBranchesWhen !== false &&
      !tags.length &&
      // There is no point in running this fallback if we already checked against all branches
      !alwaysCheckAllBranches
    ) {
      // try again, but include all tags on the repo instead of just --merged ones
      tags = await execCommand('git', defaultGitArgs).then((r) =>
        r
          .trim()
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }

    if (!tags.length) {
      return null;
    }

    const interpolatedTagPattern = interpolate(releaseTagPattern, {
      version: '%v%',
      projectName: '%p%',
      ...additionalInterpolationData,
    });

    const tagRegexp = `^${escapeRegExp(interpolatedTagPattern)
      .replace('%v%', '(.+)')
      .replace('%p%', '(.+)')}`;

    const matchingSemverTags = tags.filter(
      (tag) =>
        // Do the match against SEMVER_REGEX to ensure that we skip tags that aren't valid semver versions
        !!tag.match(tagRegexp) &&
        tag.match(tagRegexp).some((r) => r.match(SEMVER_REGEX))
    );

    if (!matchingSemverTags.length) {
      return null;
    }

    if (preId && preId.length > 0) {
      // When a preid is provided, first try to find a tag for it
      const preIdReleaseTags = matchingSemverTags.filter((tag) => {
        const match = tag.match(tagRegexp);
        if (!match) return false;
        
        const version = match.find(part => part.match(SEMVER_REGEX));
        return version && version.includes(`-${preId}.`);
      });

      if (preIdReleaseTags.length > 0) {
        return extractTagAndVersion(preIdReleaseTags[0], tagRegexp);
      }
    } 
    
    // Then try to find the latest stable release tag
    const stableReleaseTags = matchingSemverTags.filter((tag) => {
      return !!tag.match(tagRegexp) &&
        tag.match(tagRegexp).some(isStableSemver)
    });

    // If there are stable release tags, use the latest one
    if (stableReleaseTags.length > 0) {
      return extractTagAndVersion(stableReleaseTags[0], tagRegexp);
    }

    // Otherwise return null
    return null;
  } catch {
    return null;
  }
}

export async function getGitDiff(
  from: string | undefined,
  to = 'HEAD'
): Promise<RawGitCommit[]> {
  let range = '';
  if (!from || from === to) {
    range = to;
  } else {
    range = `${from}..${to}`;
  }

  // Use unique enough separators that we can be relatively certain will not occur within the commit message itself
  const commitMetadataSeparator = '§§§';
  const commitsSeparator = '|@-------@|';
  // https://git-scm.com/docs/pretty-formats
  const args = [
    '--no-pager',
    'log',
    range,
    `--pretty="${commitsSeparator}%n%s${commitMetadataSeparator}%h${commitMetadataSeparator}%an${commitMetadataSeparator}%ae%n%b"`,
    '--name-status',
  ];
  // Support cases where the nx workspace root is located at a nested path within the git repo
  const relativePath = await getGitRootRelativePath();
  if (relativePath) {
    args.push(`--relative=${relativePath}`);
  }

  const r = await execCommand('git', args);

  return r
    .split(`${commitsSeparator}\n`)
    .splice(1)
    .map((line) => {
      const [firstLine, ..._body] = line.split('\n');
      const [message, shortHash, authorName, authorEmail] = firstLine.split(
        commitMetadataSeparator
      );
      const r: RawGitCommit = {
        message,
        shortHash,
        author: { name: authorName, email: authorEmail },
        body: _body.join('\n'),
      };
      return r;
    });
}

async function getChangedTrackedFiles(cwd: string): Promise<Set<string>> {
  const result = await execCommand('git', ['status', '--porcelain'], {
    cwd,
  });
  const lines = result.split('\n').filter((l) => l.trim().length > 0);
  return new Set(lines.map((l) => l.substring(3)));
}

export async function gitAdd({
  changedFiles,
  deletedFiles,
  dryRun,
  verbose,
  logFn,
  cwd,
}: {
  changedFiles?: string[];
  deletedFiles?: string[];
  dryRun?: boolean;
  verbose?: boolean;
  cwd?: string;
  logFn?: (...messages: string[]) => void;
}): Promise<string> {
  logFn = logFn || console.log;
  // Default to running git add related commands from the workspace root
  cwd = cwd || workspaceRoot;

  let ignoredFiles: string[] = [];
  let filesToAdd: string[] = [];
  for (const f of changedFiles ?? []) {
    const isFileIgnored = await isIgnored(f, cwd);
    if (isFileIgnored) {
      ignoredFiles.push(f);
    } else {
      filesToAdd.push(f);
    }
  }

  if (deletedFiles?.length > 0) {
    const changedTrackedFiles = await getChangedTrackedFiles(cwd);
    for (const f of deletedFiles ?? []) {
      const isFileIgnored = await isIgnored(f, cwd);
      if (isFileIgnored) {
        ignoredFiles.push(f);
        // git add will fail if trying to add an untracked file that doesn't exist
      } else if (changedTrackedFiles.has(f) || dryRun) {
        filesToAdd.push(f);
      }
    }
  }

  if (verbose && ignoredFiles.length) {
    logFn(`Will not add the following files because they are ignored by git:`);
    ignoredFiles.forEach((f) => logFn(f));
  }

  if (!filesToAdd.length) {
    if (!dryRun) {
      logFn('\nNo files to stage. Skipping git add.');
    }
    // if this is a dry run, it's possible that there would have been actual files to add, so it's deceptive to say "No files to stage".
    return;
  }

  const commandArgs = ['add', ...filesToAdd];
  const message = dryRun
    ? `Would stage files in git with the following command, but --dry-run was set:`
    : `Staging files in git with the following command:`;
  if (verbose) {
    logFn(message);
    logFn(`git ${commandArgs.join(' ')}`);
  }
  if (dryRun) {
    return;
  }
  return execCommand('git', commandArgs, {
    cwd,
  });
}

async function isIgnored(filePath: string, cwd: string): Promise<boolean> {
  try {
    // This command will error if the file is not ignored
    await execCommand('git', ['check-ignore', filePath], {
      cwd,
    });
    return true;
  } catch {
    return false;
  }
}

export async function gitCommit({
  messages,
  additionalArgs,
  dryRun,
  verbose,
  logFn,
}: {
  messages: string[];
  additionalArgs?: string | string[];
  dryRun?: boolean;
  verbose?: boolean;
  logFn?: (message: string) => void;
}): Promise<string> {
  logFn = logFn || console.log;

  const commandArgs = ['commit'];
  for (const message of messages) {
    commandArgs.push('--message', message);
  }
  if (additionalArgs) {
    if (Array.isArray(additionalArgs)) {
      commandArgs.push(...additionalArgs);
    } else {
      commandArgs.push(...additionalArgs.split(' '));
    }
  }

  if (verbose) {
    logFn(
      dryRun
        ? `Would commit all previously staged files in git with the following command, but --dry-run was set:`
        : `Committing files in git with the following command:`
    );
    logFn(`git ${commandArgs.join(' ')}`);
  }

  if (dryRun) {
    return;
  }

  let hasStagedFiles = false;
  try {
    // This command will error if there are staged changes
    await execCommand('git', ['diff-index', '--quiet', 'HEAD', '--cached']);
  } catch {
    hasStagedFiles = true;
  }

  if (!hasStagedFiles) {
    logFn('\nNo staged files found. Skipping commit.');
    return;
  }

  return execCommand('git', commandArgs);
}

export async function gitTag({
  tag,
  message,
  additionalArgs,
  dryRun,
  verbose,
  logFn,
}: {
  tag: string;
  message?: string;
  additionalArgs?: string | string[];
  dryRun?: boolean;
  verbose?: boolean;
  logFn?: (message: string) => void;
}): Promise<string> {
  logFn = logFn || console.log;

  const commandArgs = [
    'tag',
    // Create an annotated tag (recommended for releases here: https://git-scm.com/docs/git-tag)
    '--annotate',
    tag,
    '--message',
    message || tag,
  ];
  if (additionalArgs) {
    if (Array.isArray(additionalArgs)) {
      commandArgs.push(...additionalArgs);
    } else {
      commandArgs.push(...additionalArgs.split(' '));
    }
  }

  if (verbose) {
    logFn(
      dryRun
        ? `Would tag the current commit in git with the following command, but --dry-run was set:`
        : `Tagging the current commit in git with the following command:`
    );
    logFn(`git ${commandArgs.join(' ')}`);
  }

  if (dryRun) {
    return;
  }

  try {
    return await execCommand('git', commandArgs);
  } catch (err) {
    throw new Error(`Unexpected error when creating tag ${tag}:\n\n${err}`);
  }
}

export async function gitPush({
  gitRemote,
  dryRun,
  verbose,
  additionalArgs,
}: {
  gitRemote?: string;
  dryRun?: boolean;
  verbose?: boolean;
  additionalArgs?: string | string[];
}) {
  const commandArgs = [
    'push',
    // NOTE: It's important we use --follow-tags, and not --tags, so that we are precise about what we are pushing
    '--follow-tags',
    '--no-verify',
    '--atomic',
    // Set custom git remote if provided
    ...(gitRemote ? [gitRemote] : []),
  ];
  if (additionalArgs) {
    if (Array.isArray(additionalArgs)) {
      commandArgs.push(...additionalArgs);
    } else {
      commandArgs.push(...additionalArgs.split(' '));
    }
  }

  if (verbose) {
    console.log(
      dryRun
        ? `Would push the current branch to the remote with the following command, but --dry-run was set:`
        : `Pushing the current branch to the remote with the following command:`
    );
    console.log(`git ${commandArgs.join(' ')}`);
  }

  if (dryRun) {
    return;
  }

  try {
    await execCommand('git', commandArgs);
  } catch (err) {
    throw new Error(`Unexpected git push error: ${err}`);
  }
}

export function parseCommits(commits: RawGitCommit[]): GitCommit[] {
  return commits.map((commit) => parseGitCommit(commit)).filter(Boolean);
}

export function parseConventionalCommitsMessage(message: string): {
  type: string;
  scope: string;
  description: string;
  breaking: boolean;
} | null {
  const match = message.match(ConventionalCommitRegex);
  if (!match) {
    return {
      type: '__INVALID__',
      scope: '',
      description: message,
      breaking: false,
    };
  }

  return {
    type: match.groups.type || '',
    scope: match.groups.scope || '',
    description: match.groups.description || '',
    breaking: Boolean(match.groups.breaking),
  };
}

export function extractReferencesFromCommit(commit: RawGitCommit): Reference[] {
  const references: Reference[] = [];

  // Extract GitHub style PR references from commit message
  for (const m of commit.message.matchAll(PullRequestRE)) {
    references.push({ type: 'pull-request', value: m[1] });
  }

  // Extract GitLab style merge request references from commit body
  for (const m of commit.body.matchAll(GitLabMergeRequestRE)) {
    if (m[1]) {
      references.push({ type: 'pull-request', value: m[1] });
    }
  }

  // Extract issue references from commit message
  for (const m of commit.message.matchAll(IssueRE)) {
    if (!references.some((i) => i.value === m[1])) {
      references.push({ type: 'issue', value: m[1] });
    }
  }

  // Extract issue references from commit body
  for (const m of commit.body.matchAll(IssueRE)) {
    if (!references.some((i) => i.value === m[1])) {
      references.push({ type: 'issue', value: m[1] });
    }
  }

  // Add commit hash reference
  references.push({ value: commit.shortHash, type: 'hash' });

  return references;
}

function getAllAuthorsForCommit(commit: RawGitCommit): GitCommitAuthor[] {
  const authors: GitCommitAuthor[] = [commit.author];
  // Additional authors can be specified in the commit body (depending on the VCS provider)
  for (const match of commit.body.matchAll(CoAuthoredByRegex)) {
    authors.push({
      name: (match.groups.name || '').trim(),
      email: (match.groups.email || '').trim(),
    });
  }
  return authors;
}

// https://www.conventionalcommits.org/en/v1.0.0/
// https://regex101.com/r/FSfNvA/1
const ConventionalCommitRegex =
  /(?<type>[a-z]+)(\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
const CoAuthoredByRegex = /co-authored-by:\s*(?<name>.+)(<(?<email>.+)>)/gim;
// GitHub style PR references
const PullRequestRE = /\([ a-z]*(#\d+)\s*\)/gm;
// GitLab style merge request references
const GitLabMergeRequestRE = /See merge request (?:[a-z0-9/-]+)?(![\d]+)/gim;
const IssueRE = /(#\d+)/gm;
const ChangedFileRegex = /(A|M|D|R\d*|C\d*)\t([^\t\n]*)\t?(.*)?/gm;
const RevertHashRE = /This reverts commit (?<hash>[\da-f]{40})./gm;

export function parseGitCommit(
  commit: RawGitCommit,
  isVersionPlanCommit = false
): GitCommit | null {
  // For version plans, we do not require conventional commits and therefore cannot extract data based on that format
  if (isVersionPlanCommit) {
    return {
      ...commit,
      description: commit.message,
      type: '',
      scope: '',
      references: extractReferencesFromCommit(commit),
      // The commit message is not the source of truth for a breaking (major) change in version plans, so the value is not relevant
      // TODO(v22): Make the current GitCommit interface more clearly tied to conventional commits
      isBreaking: false,
      authors: getAllAuthorsForCommit(commit),
      // Not applicable to version plans
      affectedFiles: [],
      // Not applicable, a version plan cannot have been added in a commit that also reverts another commit
      revertedHashes: [],
    };
  }

  const parsedMessage = parseConventionalCommitsMessage(commit.message);
  if (!parsedMessage) {
    return null;
  }

  const scope = parsedMessage.scope;
  const isBreaking =
    parsedMessage.breaking || commit.body.includes('BREAKING CHANGE:');
  let description = parsedMessage.description;

  // Extract issue and PR references from the commit
  const references = extractReferencesFromCommit(commit);

  // Remove GitHub style references from description (NOTE: GitLab style references only seem to appear in the body, so we don't need to remove them here)
  description = description.replace(PullRequestRE, '').trim();

  let type = parsedMessage.type;
  // Extract any reverted hashes, if applicable
  const revertedHashes = [];
  const matchedHashes = commit.body.matchAll(RevertHashRE);
  for (const matchedHash of matchedHashes) {
    revertedHashes.push(matchedHash.groups.hash);
  }
  if (revertedHashes.length) {
    type = 'revert';
    description = commit.message;
  }

  // Find all authors
  const authors = getAllAuthorsForCommit(commit);

  // Extract file changes from commit body
  const affectedFiles = Array.from(
    commit.body.matchAll(ChangedFileRegex)
  ).reduce(
    (prev, [fullLine, changeType, file1, file2]: RegExpExecArray) =>
      // file2 only exists for some change types, such as renames
      file2 ? [...prev, file1, file2] : [...prev, file1],
    [] as string[]
  );

  return {
    ...commit,
    authors,
    description,
    type,
    scope,
    references,
    isBreaking,
    revertedHashes,
    affectedFiles,
  };
}

export async function getCommitHash(ref: string) {
  try {
    return (await execCommand('git', ['rev-parse', ref])).trim();
  } catch (e) {
    throw new Error(`Unknown revision: ${ref}`);
  }
}

export async function getFirstGitCommit() {
  try {
    return (
      await execCommand('git', [
        'rev-list',
        '--max-parents=0',
        'HEAD',
        '--first-parent',
      ])
    ).trim();
  } catch (e) {
    throw new Error(`Unable to find first commit in git history`);
  }
}

async function getGitRoot() {
  try {
    return (await execCommand('git', ['rev-parse', '--show-toplevel'])).trim();
  } catch (e) {
    throw new Error('Unable to find git root');
  }
}

let gitRootRelativePath: string;
async function getGitRootRelativePath() {
  if (!gitRootRelativePath) {
    const gitRoot = await getGitRoot();
    gitRootRelativePath = relative(gitRoot, workspaceRoot);
  }
  return gitRootRelativePath;
}
