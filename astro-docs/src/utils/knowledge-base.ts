import type { CollectionEntry } from 'astro:content';
import { getNewestCommitDate } from 'virtual:starlight/git-info';
import knowledgeBaseTopics from '../data/knowledge-base-topics.json';

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
        lastModified: getNewestCommitDate(doc.filePath),
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
