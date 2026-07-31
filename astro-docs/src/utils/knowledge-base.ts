import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import type { CollectionEntry } from 'astro:content';
import { getNewestCommitDate } from 'virtual:starlight/git-info';
import knowledgeBaseTopics from '../data/knowledge-base-topics.json';

// Vite invalidates this module whenever content changes, which would drop a
// module-scoped cache and re-walk git on every dev navigation. Commit dates only
// move when a commit lands, never when an author edits a file, so hang the cache
// off globalThis and build it once per process.
const CACHE_KEY = '__nxDocsLastModifiedIndex';

// One `git log` for every article instead of one per article. Per-article
// `--follow` forces full rename detection on each call, which cost ~105s across
// the KB and blocked the event loop, since execFileSync is synchronous.
//
// The pathspec has to span the whole content root, not just `kb/`. Scoped to
// `kb/` alone, git can't pair the two sides of the KB rework's moves and reports
// every article as an add, which would date them all to the day of the move.
function buildLastModifiedIndex(
  repoRoot: string,
  contentRoot: string,
  // git path as of the commit being walked -> the file path the caller asked for
  pathAtCommit: Map<string, string>
): Map<string, Date> {
  const lastModified = new Map<string, Date>();

  try {
    // NUL-delimit records so each splits into date + its name-status lines.
    const log = execFileSync(
      'git',
      ['log', '-M', '--name-status', '--format=%x00%cI', '--', contentRoot],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      }
    );

    for (const record of log.split('\0')) {
      const [iso, ...statusLines] = record.split('\n').filter(Boolean);
      if (!iso) continue;
      const date = new Date(iso);

      for (const line of statusLines) {
        const fields = line.split('\t');

        if (fields[0].startsWith('R')) {
          // A move is not a content edit, so keep walking under the old path.
          const [, from, to] = fields;
          const current = pathAtCommit.get(to);
          if (current === undefined) continue;
          pathAtCommit.delete(to);
          pathAtCommit.set(from, current);
          continue;
        }

        const current = pathAtCommit.get(fields[fields.length - 1]);
        // git logs newest first, so the first edit seen for a file is its latest.
        if (current !== undefined && !lastModified.has(current)) {
          lastModified.set(current, date);
        }
      }
    }
  } catch {
    // Not a git checkout or no reachable history; callers fall back to starlight.
  }

  return lastModified;
}

function getLastModifiedIndex(filePaths: string[]): Map<string, Date> {
  const store = globalThis as Record<string, unknown>;
  const cached = store[CACHE_KEY] as Map<string, Date> | undefined;
  if (cached) return cached;

  let index = new Map<string, Date>();
  try {
    const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();

    // git reports paths from the repository root, Astro reports them from the
    // working directory. Match on git's form, return the caller's.
    const pathAtCommit = new Map(
      filePaths.map((path) => [relative(repoRoot, resolve(path)), path])
    );

    // Every article lives at <contentRoot>/kb/<slug>.mdoc.
    const anyPath = pathAtCommit.keys().next().value as string;
    const contentRoot = anyPath.slice(0, anyPath.lastIndexOf('/kb/'));

    index = buildLastModifiedIndex(repoRoot, contentRoot, pathAtCommit);
  } catch {
    // Not a git checkout; callers fall back to starlight.
  }

  store[CACHE_KEY] = index;
  return index;
}

export interface KnowledgeBaseTopic {
  id: string;
  label: string;
  description: string;
  legacyIndex?: boolean;
}

export interface KnowledgeBaseArticle {
  slug: string;
  title: string;
  description: string;
  href: string;
  topics: string[];
  featured: boolean;
  lastModified: Date;
}

export const kbTopics = knowledgeBaseTopics as KnowledgeBaseTopic[];

export function getKnowledgeBaseArticles(
  docs: CollectionEntry<'docs'>[]
): KnowledgeBaseArticle[] {
  const kbDocs = docs.filter((doc) => doc.id.startsWith('kb/'));
  for (const doc of kbDocs) {
    if (!doc.filePath) {
      throw new Error(`Could not resolve the source file for ${doc.id}`);
    }
  }

  const filePaths = kbDocs.map((doc) => doc.filePath as string);
  const lastModified = filePaths.length
    ? getLastModifiedIndex(filePaths)
    : new Map<string, Date>();

  return kbDocs.map((doc) => {
    const filePath = doc.filePath as string;
    const slug = doc.id.slice('kb/'.length);
    return {
      slug,
      title: doc.data.title,
      description: doc.data.description,
      href: `/docs/kb/${slug}`,
      topics: doc.data.topics ?? [],
      featured: doc.data.featured ?? false,
      // Falls back to the starlight date when the file has no history of its
      // own (shallow clone, or a page that isn't committed yet).
      lastModified: lastModified.get(filePath) ?? getNewestCommitDate(filePath),
    };
  });
}

export function getTopicId(label: string): string {
  const topic = kbTopics.find((candidate) => candidate.label === label);
  if (!topic) throw new Error(`Unknown Knowledge Base topic: ${label}`);
  return topic.id;
}

export function sortArticlesByTitle(
  articles: KnowledgeBaseArticle[]
): KnowledgeBaseArticle[] {
  return [...articles].sort((left, right) =>
    left.title.localeCompare(right.title)
  );
}

export function sortArticlesByLastModified(
  articles: KnowledgeBaseArticle[]
): KnowledgeBaseArticle[] {
  return [...articles].sort(
    (left, right) =>
      right.lastModified.getTime() - left.lastModified.getTime() ||
      left.title.localeCompare(right.title)
  );
}
