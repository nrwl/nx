import { execFileSync } from 'node:child_process';
import type { CollectionEntry } from 'astro:content';
import { getNewestCommitDate } from 'virtual:starlight/git-info';
import knowledgeBaseTopics from '../data/knowledge-base-topics.json';

const lastModifiedCache = new Map<string, Date>();

// Plain newest-commit date follows bulk file moves (e.g. the KB rework), so
// skip rename commits (R*) and take the newest real edit. Falls back to the
// starlight date when history is unavailable (shallow clone).
function getArticleLastModified(filePath: string): Date {
  const cached = lastModifiedCache.get(filePath);
  if (cached) return cached;

  let lastModified = getNewestCommitDate(filePath);
  try {
    // NUL-delimit records so each splits into date + its name-status lines.
    const log = execFileSync(
      'git',
      [
        'log',
        '--follow',
        '-M',
        '--name-status',
        '--format=%x00%cI',
        '--',
        filePath,
      ],
      { encoding: 'utf8', windowsHide: true }
    );
    for (const record of log.split('\0')) {
      const [iso, ...statusLines] = record.split('\n').filter(Boolean);
      if (!iso) continue;
      const status = statusLines[0]?.split('\t')[0] ?? '';
      if (status.startsWith('R')) continue; // rename/move, not a content edit
      lastModified = new Date(iso);
      break;
    }
  } catch {
    // Not a git checkout or no reachable history; keep the starlight date.
  }

  lastModifiedCache.set(filePath, lastModified);
  return lastModified;
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
  return docs
    .filter((doc) => doc.id.startsWith('kb/'))
    .map((doc) => {
      if (!doc.filePath) {
        throw new Error(`Could not resolve the source file for ${doc.id}`);
      }

      const slug = doc.id.slice('kb/'.length);
      return {
        slug,
        title: doc.data.title,
        description: doc.data.description,
        href: `/docs/kb/${slug}`,
        topics: doc.data.topics ?? [],
        featured: doc.data.featured ?? false,
        lastModified: getArticleLastModified(doc.filePath),
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
