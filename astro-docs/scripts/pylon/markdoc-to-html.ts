/**
 * Converts a .mdoc article to standalone HTML suitable for Pylon's
 * body_html field. The site's markdoc.config.mjs renders tags to Astro
 * components, so this module defines its own plain-HTML transforms for the
 * tags actually used by knowledge-base candidates. Any other tag is a hard
 * error — extend the table or exclude the article.
 */
import Markdoc, { Tag, type Config, type Node } from '@markdoc/markdoc';
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NX_DEV_ORIGIN, docsPathForSource } from './config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ConvertedArticle {
  title: string;
  description: string;
  html: string;
  docsPath: string;
  /** Absolute paths of local images referenced by the article. Their `src`
   * in `html` is `pylon-image:<absolute path>` until uploads resolve them. */
  images: string[];
  /** True when the HTML contains the `{pageUrl}` placeholder that must be
   * substituted with the article's canonical Pylon URL. */
  hasPageUrlPlaceholder: boolean;
}

export const IMAGE_PLACEHOLDER_PREFIX = 'pylon-image:';

// Sanitizer probe (2026-07-07) confirmed Pylon preserves iframes.
const ALLOW_IFRAMES = true;

// Interactive {% graph %} components can't survive migration; each affected
// article needs a pre-captured static screenshot registered here (keyed by
// docs route). Capture with Playwright against a local preview.
const GRAPH_SCREENSHOTS: Record<string, string> = {
  '/docs/guides/tips-n-tricks/identify-dependencies-between-folders': path.join(
    __dirname,
    'assets',
    'identify-dependencies-graph.png'
  ),
};

const ASIDE_LABELS: Record<string, string> = {
  note: 'ℹ️ Note',
  tip: '💡 Tip',
  caution: '⚠️ Caution',
  danger: '🚨 Danger',
  warning: '⚠️ Warning',
  check: '✅ Check',
  announcement: '📢 Announcement',
  deepdive: '🔍 Deep dive',
};

function asideTransform(node: Node, config: Config): Tag {
  const attrs = node.attributes;
  const label =
    attrs.title ?? ASIDE_LABELS[attrs.type as string] ?? ASIDE_LABELS.note;
  return new Tag('blockquote', {}, [
    new Tag('p', {}, [new Tag('strong', {}, [String(label)])]),
    ...node.transformChildren(config),
  ]);
}

function buildTagConfig(articleDocsPath: string): Config {
  return {
    tags: {
      aside: { transform: asideTransform },
      callout: { transform: asideTransform },
      youtube: {
        selfClosing: true,
        transform(node, config) {
          const attrs = node.attributes;
          const src = String(attrs.src ?? '');
          const title = String(attrs.title ?? 'Video');
          if (ALLOW_IFRAMES) {
            const embed = src
              .replace('https://youtu.be/', 'https://www.youtube.com/embed/')
              .replace('/watch?v=', '/embed/');
            return new Tag('iframe', {
              src: embed,
              title,
              width: '560',
              height: '315',
              frameborder: '0',
              allowfullscreen: '',
            });
          }
          return new Tag('p', {}, [
            new Tag('a', { href: src }, [`▶ Watch: ${title} (video)`]),
          ]);
        },
      },
      tabs: {
        transform(node, config) {
          return new Tag('div', {}, node.transformChildren(config));
        },
      },
      tabitem: {
        transform(node, config) {
          const attrs = node.attributes;
          return new Tag('div', {}, [
            new Tag('h3', {}, [String(attrs.label ?? '')]),
            ...node.transformChildren(config),
          ]);
        },
      },
      filetree: {
        transform(node, config) {
          return new Tag('div', {}, node.transformChildren(config));
        },
      },
      llm_copy_prompt: {
        transform(node, config) {
          const attrs = node.attributes;
          return new Tag('details', {}, [
            new Tag('summary', {}, [
              new Tag('strong', {}, [String(attrs.title ?? 'Prompt')]),
            ]),
            ...node.transformChildren(config),
          ]);
        },
      },
      llm_only: {
        transform() {
          return null;
        },
      },
      graph: {
        transform(node) {
          const shot = GRAPH_SCREENSHOTS[articleDocsPath];
          if (!shot) {
            throw new Error(
              `{% graph %} in ${articleDocsPath} has no screenshot registered in GRAPH_SCREENSHOTS`
            );
          }
          // Children (the inline graph JSON) are intentionally dropped.
          const title = String(node.attributes.title ?? 'Project graph');
          return new Tag('div', {}, [
            new Tag('img', {
              src: `${IMAGE_PLACEHOLDER_PREFIX}${shot}`,
              alt: title,
            }),
            new Tag('p', {}, [
              new Tag('em', {}, [
                'Static snapshot of the interactive graph. Run ',
              ]),
              new Tag('code', {}, ['nx graph']),
              new Tag('em', {}, [
                ' in your own workspace for the interactive version.',
              ]),
            ]),
          ]);
        },
      },
    },
    nodes: {
      fence: {
        attributes: {
          content: { type: String },
          language: { type: String },
        },
        transform(node) {
          const language = node.attributes.language
            ? { class: `language-${node.attributes.language}` }
            : {};
          return new Tag('pre', {}, [
            new Tag('code', language, [String(node.attributes.content ?? '')]),
          ]);
        },
      },
      link: {
        attributes: { href: { type: String }, title: { type: String } },
        transform(node, config) {
          return new Tag(
            'a',
            { href: absolutizeHref(node.attributes.href, articleDocsPath) },
            node.transformChildren(config)
          );
        },
      },
      image: {
        attributes: {
          src: { type: String },
          alt: { type: String },
          title: { type: String },
        },
        transform(node) {
          return new Tag('img', {
            src: node.attributes.src,
            alt: node.attributes.alt ?? '',
          });
        },
      },
    },
  };
}

function absolutizeHref(href: unknown, articleDocsPath: string): string {
  const raw = String(href ?? '');
  if (/^(https?:)?\/\//.test(raw) || raw.startsWith('mailto:')) return raw;
  if (raw.startsWith('#')) return raw;
  if (raw.startsWith('/')) return `${NX_DEV_ORIGIN}${raw}`;
  // Relative links resolve against the article's route.
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(articleDocsPath), raw)
  );
  return `${NX_DEV_ORIGIN}${resolved}`;
}

function splitFrontmatter(source: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: {}, body: source };
  return {
    frontmatter: (yaml.load(match[1]) as Record<string, unknown>) ?? {},
    body: source.slice(match[0].length),
  };
}

export function convertArticle(sourcePath: string): ConvertedArticle {
  const source = fs.readFileSync(sourcePath, 'utf-8');
  const { frontmatter, body } = splitFrontmatter(source);
  const docsPath = docsPathForSource(sourcePath);
  const config = buildTagConfig(docsPath);

  const ast = Markdoc.parse(body);

  const knownTags = new Set(Object.keys(config.tags ?? {}));
  for (const node of ast.walk()) {
    if (node.type === 'tag' && node.tag && !knownTags.has(node.tag)) {
      throw new Error(
        `${sourcePath}:${node.lines?.[0] ?? '?'} uses tag {% ${node.tag} %} which has no HTML transform. ` +
          `Add one to markdoc-to-html.ts or exclude this article.`
      );
    }
  }

  const images: string[] = [];
  for (const node of ast.walk()) {
    if (node.type === 'tag' && node.tag === 'graph') {
      const shot = GRAPH_SCREENSHOTS[docsPath];
      if (!shot || !fs.existsSync(shot)) {
        throw new Error(
          `${sourcePath}: {% graph %} needs a screenshot registered in GRAPH_SCREENSHOTS`
        );
      }
      images.push(shot);
    }
    if (node.type === 'image') {
      const src = String(node.attributes.src ?? '');
      if (/^(https?:)?\/\//.test(src)) continue;
      const absolute = src.startsWith('/')
        ? null
        : path.resolve(path.dirname(sourcePath), src);
      if (absolute && fs.existsSync(absolute)) {
        images.push(absolute);
        node.attributes.src = `${IMAGE_PLACEHOLDER_PREFIX}${absolute}`;
      } else if (src.startsWith('/')) {
        node.attributes.src = `${NX_DEV_ORIGIN}${src}`;
      } else {
        throw new Error(
          `${sourcePath}: image "${src}" not found on disk — cannot migrate`
        );
      }
    }
  }

  const transformed = Markdoc.transform(ast, config);
  const html = Markdoc.renderers.html(transformed);

  return {
    title: String(frontmatter.title ?? ''),
    description: String(frontmatter.description ?? ''),
    html,
    docsPath,
    images,
    hasPageUrlPlaceholder: html.includes('{pageUrl}'),
  };
}
