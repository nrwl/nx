/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */
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

export async function getLatestGitTagForPattern(
  releaseTagPattern: string,
  additionalInterpolationData = {}
): Promise<{ tag: string; extractedVersion: string } | null> {
  try {
    let tags: string[];
    tags = await execCommand('git', [
      'tag',
      '--sort',
      '-v:refname',
      '--merged',
    ]).then((r) =>
      r
        .trim()
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
    );
    if (!tags.length) {
      // try again, but include all tags on the repo instead of just --merged ones
      tags = await execCommand('git', ['tag', '--sort', '-v:refname']).then(
        (r) =>
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

    const [latestMatchingTag, ...rest] = matchingSemverTags[0].match(tagRegexp);
    const version = rest.filter((r) => {
      return r.match(SEMVER_REGEX);
    })[0];

    return {
      tag: latestMatchingTag,
      extractedVersion: version,
    };
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

  // Use a unique enough separator that we can be relatively certain will not occur within the commit message itself
  const separator = '§§§';

  // https://git-scm.com/docs/pretty-formats
  const r = await execCommand('git', [
    '--no-pager',
    'log',
    range,
    `--pretty="----%n%s${separator}%h${separator}%an${separator}%ae%n%b"`,
    '--name-status',
  ]);

  return r
    .split('----\n')
    .splice(1)
    .map((line) => {
      const [firstLine, ..._body] = line.split('\n');
      const [message, shortHash, authorName, authorEmail] =
        firstLine.split(separator);
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
}: {
  gitRemote?: string;
  dryRun?: boolean;
  verbose?: boolean;
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
    return null;
  }

  return {
    type: match.groups.type || '',
    scope: match.groups.scope || '',
    description: match.groups.description || '',
    breaking: Boolean(match.groups.breaking),
  };
}

function extractReferencesFromCommitMessage(
  message: string,
  shortHash: string
): Reference[] {
  const references: Reference[] = [];
  for (const m of message.matchAll(PullRequestRE)) {
    references.push({ type: 'pull-request', value: m[1] });
  }
  for (const m of message.matchAll(IssueRE)) {
    if (!references.some((i) => i.value === m[1])) {
      references.push({ type: 'issue', value: m[1] });
    }
  }
  references.push({ value: shortHash, type: 'hash' });
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
const PullRequestRE = /\([ a-z]*(#\d+)\s*\)/gm;
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
      references: extractReferencesFromCommitMessage(
        commit.message,
        commit.shortHash
      ),
      // The commit message is not the source of truth for a breaking (major) change in version plans, so the value is not relevant
      // TODO(v20): Make the current GitCommit interface more clearly tied to conventional commits
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

  // Extract references from message
  const references = extractReferencesFromCommitMessage(
    description,
    commit.shortHash
  );

  // Remove references and normalize
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
