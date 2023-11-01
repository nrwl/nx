/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */
import { interpolate } from '../../../tasks-runner/utils';
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
    const tags = await execCommand('git', ['tag', '--sort', '-v:refname']).then(
      (r) =>
        r
          .trim()
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
    );
    if (!tags.length) {
      return null;
    }

    const interpolatedTagPattern = interpolate(releaseTagPattern, {
      version: ' ',
      ...additionalInterpolationData,
    });

    const tagRegexp = `^${escapeRegExp(interpolatedTagPattern).replace(
      ' ',
      '(.+)'
    )}`;
    const matchingSemverTags = tags.filter(
      (tag) =>
        // Do the match against SEMVER_REGEX to ensure that we skip tags that aren't valid semver versions
        !!tag.match(tagRegexp) && tag.match(tagRegexp)[1]?.match(SEMVER_REGEX)
    );

    if (!matchingSemverTags.length) {
      return null;
    }

    const [latestMatchingTag, version] = matchingSemverTags[0].match(tagRegexp);

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
  // https://git-scm.com/docs/pretty-formats
  const r = await execCommand('git', [
    '--no-pager',
    'log',
    `${from ? `${from}...` : ''}${to}`,
    '--pretty="----%n%s|%h|%an|%ae%n%b"',
    '--name-status',
  ]);
  return r
    .split('----\n')
    .splice(1)
    .map((line) => {
      const [firstLine, ..._body] = line.split('\n');
      const [message, shortHash, authorName, authorEmail] =
        firstLine.split('|');
      const r: RawGitCommit = {
        message,
        shortHash,
        author: { name: authorName, email: authorEmail },
        body: _body.join('\n'),
      };
      return r;
    });
}

export function parseCommits(commits: RawGitCommit[]): GitCommit[] {
  return commits.map((commit) => parseGitCommit(commit)).filter(Boolean);
}

// https://www.conventionalcommits.org/en/v1.0.0/
// https://regex101.com/r/FSfNvA/1
const ConventionalCommitRegex =
  /(?<type>[a-z]+)(\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
const CoAuthoredByRegex = /co-authored-by:\s*(?<name>.+)(<(?<email>.+)>)/gim;
const PullRequestRE = /\([ a-z]*(#\d+)\s*\)/gm;
const IssueRE = /(#\d+)/gm;
const ChangedFileRegex = /(A|M|D|R\d*|C\d*)\t([^\t\n]*)\t?(.*)?/gm;

export function parseGitCommit(commit: RawGitCommit): GitCommit | null {
  const match = commit.message.match(ConventionalCommitRegex);
  if (!match) {
    return null;
  }

  const type = match.groups.type;

  const scope = match.groups.scope || '';

  const isBreaking = Boolean(match.groups.breaking);
  let description = match.groups.description;

  // Extract references from message
  const references: Reference[] = [];
  for (const m of description.matchAll(PullRequestRE)) {
    references.push({ type: 'pull-request', value: m[1] });
  }
  for (const m of description.matchAll(IssueRE)) {
    if (!references.some((i) => i.value === m[1])) {
      references.push({ type: 'issue', value: m[1] });
    }
  }
  references.push({ value: commit.shortHash, type: 'hash' });

  // Remove references and normalize
  description = description.replace(PullRequestRE, '').trim();

  // Find all authors
  const authors: GitCommitAuthor[] = [commit.author];
  for (const match of commit.body.matchAll(CoAuthoredByRegex)) {
    authors.push({
      name: (match.groups.name || '').trim(),
      email: (match.groups.email || '').trim(),
    });
  }

  // Extract file changes from commit body
  const affectedFiles = Array.from(
    commit.body.matchAll(ChangedFileRegex)
  ).reduce(
    (
      prev,
      [fullLine, changeType, file1, file2]: [string, string, string, string?]
    ) =>
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
    affectedFiles,
  };
}
