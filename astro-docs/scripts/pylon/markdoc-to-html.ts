/**
 * Converts a `/docs/kb` Markdoc article into the HTML Pylon stores as an
 * article body.
 *
 * Pylon persists `body_html` verbatim - create, patch and publish all round
 * trip byte for byte - so the output is compared directly against the live
 * article to decide whether a push is needed. Anything emitted here must
 * therefore be deterministic.
 *
 * Interactive tags (project graphs, generated card indexes) have no HTML
 * equivalent and become a pointer back to the canonical nx.dev page.
 */

import Markdoc, { type Node } from '@markdoc/markdoc';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

/** An image the sync has to make reachable from Pylon's CDN. */
export interface AssetRef {
  /**
   * Identity of the image contents, embedded in the emitted `data-nx-src` so a
   * later run can reuse the URL already uploaded for it.
   */
  key: string;
  absolutePath: string;
  fileName: string;
  contentType: string;
}

export interface ConvertOptions {
  /** Absolute path of the `.mdoc` file, used to resolve relative image paths. */
  sourcePath: string;
  /** Absolute path of `astro-docs/public`, the root for `/`-prefixed images. */
  publicDir: string;
  /** Repository root, used to build stable asset keys. */
  repoRoot: string;
  /** Canonical page on nx.dev, e.g. `https://nx.dev/docs/kb/caching`. */
  canonicalUrl: string;
  /** Origin used to absolutize root-relative links, e.g. `https://nx.dev`. */
  siteUrl: string;
}

export interface ConvertResult {
  title: string;
  description: string;
  /** Image `src` values are `nx-asset:<key>` placeholders the caller resolves. */
  html: string;
  assets: AssetRef[];
  warnings: string[];
}

export const ASSET_PLACEHOLDER_PREFIX = 'nx-asset:';

const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

/** Fallback headings for `aside`/`callout` blocks that carry no title. */
const CALLOUT_LABELS: Record<string, string> = {
  announcement: 'Announcement',
  caution: 'Caution',
  check: 'Check',
  danger: 'Danger',
  deepdive: 'Deep dive',
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
};

export function convertArticle(
  source: string,
  options: ConvertOptions
): ConvertResult {
  const ast = Markdoc.parse(stripHtmlComments(source));
  const frontmatter = parseFrontmatter(ast.attributes?.frontmatter ?? '');
  const converter = new Converter(options);
  const body = converter.renderChildren(ast);

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    html: body + converter.renderCanonicalFooter(),
    assets: [...converter.assets.values()],
    warnings: converter.warnings,
  };
}

class Converter {
  readonly assets = new Map<string, AssetRef>();
  readonly warnings: string[] = [];
  #options: ConvertOptions;

  constructor(options: ConvertOptions) {
    this.#options = options;
  }

  renderCanonicalFooter(): string {
    return (
      `<hr /><p><em>This article mirrors the Nx documentation. ` +
      `Read the latest version at <a href="${escapeAttribute(this.#options.canonicalUrl)}">` +
      `${escapeText(this.#options.canonicalUrl)}</a>.</em></p>`
    );
  }

  renderChildren(node: Node): string {
    return (node.children ?? []).map((child) => this.render(child)).join('');
  }

  render(node: Node): string {
    const attributes = (node.attributes ?? {}) as Record<string, unknown>;

    switch (node.type) {
      case 'document':
      case 'inline':
        return this.renderChildren(node);

      case 'text':
        return escapeText(String(attributes.content ?? ''));

      case 'softbreak':
        return '\n';
      case 'hardbreak':
        return '<br />';

      case 'paragraph':
        return `<p>${this.renderChildren(node)}</p>`;

      case 'heading': {
        // Pylon renders the article title as the page h1, so demote any h1.
        const level = Math.min(Math.max(Number(attributes.level ?? 2), 2), 6);
        return `<h${level}>${this.renderChildren(node)}</h${level}>`;
      }

      case 'strong':
        return `<strong>${this.renderChildren(node)}</strong>`;
      case 'em':
        return `<em>${this.renderChildren(node)}</em>`;
      case 's':
        return `<s>${this.renderChildren(node)}</s>`;

      case 'code':
        return `<code>${escapeText(String(attributes.content ?? ''))}</code>`;

      case 'fence':
        return this.#renderFence(attributes);

      case 'link': {
        const href = this.#absolutizeLink(String(attributes.href ?? ''));
        return `<a href="${escapeAttribute(href)}">${this.renderChildren(node)}</a>`;
      }

      case 'image':
        return this.#renderImage(attributes);

      case 'list':
        return attributes.ordered
          ? `<ol>${this.renderChildren(node)}</ol>`
          : `<ul>${this.renderChildren(node)}</ul>`;
      case 'item':
        return `<li>${unwrapSingleParagraph(this.renderChildren(node))}</li>`;

      case 'blockquote':
        return `<blockquote>${this.renderChildren(node)}</blockquote>`;

      case 'table':
        return `<table>${this.renderChildren(node)}</table>`;
      case 'thead':
        return `<thead>${this.renderChildren(node)}</thead>`;
      case 'tbody':
        return `<tbody>${this.renderChildren(node)}</tbody>`;
      case 'tr':
        return `<tr>${this.renderChildren(node)}</tr>`;
      case 'th':
      case 'td': {
        const align = attributes.align
          ? ` align="${escapeAttribute(String(attributes.align))}"`
          : '';
        return `<${node.type}${align}>${this.renderChildren(node)}</${node.type}>`;
      }

      case 'hr':
        return '<hr />';

      case 'comment':
      case 'error':
        return '';

      case 'tag':
        return this.#renderTag(node, attributes);

      default:
        this.warnings.push(`unhandled node type "${node.type}"`);
        return this.renderChildren(node);
    }
  }

  #renderFence(attributes: Record<string, unknown>): string {
    const language = String(attributes.language ?? '').trim();
    const languageClass = language
      ? ` class="language-${escapeAttribute(language)}"`
      : '';
    const code = `<pre><code${languageClass}>${escapeText(String(attributes.content ?? ''))}</code></pre>`;

    // `title` names the file or terminal the snippet belongs to; keep it as a
    // caption. `meta` carries line-highlight ranges with no HTML equivalent.
    const title = attributes.title ? String(attributes.title) : '';
    return title ? `<p><code>${escapeText(title)}</code></p>${code}` : code;
  }

  #renderImage(attributes: Record<string, unknown>): string {
    const src = String(attributes.src ?? '');
    const alt = escapeAttribute(String(attributes.alt ?? ''));

    const absolutePath = src.startsWith('/')
      ? resolve(this.#options.publicDir, src.slice(1))
      : resolve(dirname(this.#options.sourcePath), src);

    if (!existsSync(absolutePath)) {
      this.warnings.push(`image not found on disk: ${src}`);
      return `<img src="${escapeAttribute(this.#absolutizeLink(src))}" alt="${alt}" />`;
    }

    const extension = absolutePath.split('.').pop()?.toLowerCase() ?? '';
    const repoRelative = relative(this.#options.repoRoot, absolutePath);
    const digest = createHash('sha256')
      .update(readFileSync(absolutePath))
      .digest('hex')
      .slice(0, 16);
    const key = `${repoRelative}#${digest}`;

    this.assets.set(key, {
      key,
      absolutePath,
      fileName: absolutePath.split('/').pop() ?? 'image',
      contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream',
    });

    return (
      `<img src="${ASSET_PLACEHOLDER_PREFIX}${escapeAttribute(key)}" ` +
      `alt="${alt}" data-nx-src="${escapeAttribute(key)}" />`
    );
  }

  #renderTag(node: Node, attributes: Record<string, unknown>): string {
    const attribute = (name: string): string =>
      attributes[name] === undefined ? '' : String(attributes[name]);

    switch (node.tag) {
      // Starlight asides and the Nx callout render the same way: a quoted
      // block led by its title.
      case 'aside':
      case 'callout': {
        const label =
          attribute('title') ||
          CALLOUT_LABELS[attribute('type')] ||
          CALLOUT_LABELS.note;
        return (
          `<blockquote><p><strong>${escapeText(label)}</strong></p>` +
          `${this.renderChildren(node)}</blockquote>`
        );
      }

      // Tab groups flatten to sequential sections - each panel keeps its label
      // as a heading so the alternatives stay distinguishable.
      case 'tabs':
        return this.renderChildren(node);
      case 'tabitem':
        return (
          `<h4>${escapeText(attribute('label'))}</h4>` +
          this.renderChildren(node)
        );

      // A file tree is already authored as a nested list.
      case 'filetree':
        return this.renderChildren(node);

      case 'youtube': {
        const embedUrl = toYoutubeEmbedUrl(attribute('src'));
        const caption = attribute('caption');
        return (
          `<iframe src="${escapeAttribute(embedUrl)}" ` +
          `title="${escapeAttribute(attribute('title'))}" width="100%" height="400" ` +
          `frameborder="0" allowfullscreen></iframe>` +
          (caption ? `<p><em>${escapeText(caption)}</em></p>` : '')
        );
      }

      case 'course_video':
        return this.#renderLinkParagraph(
          attribute('courseUrl') || attribute('src'),
          attribute('courseTitle') || 'Watch the course'
        );

      case 'github_repository':
        return this.#renderLinkParagraph(
          attribute('url'),
          attribute('title') || attribute('url')
        );

      case 'call_to_action': {
        const description = attribute('description');
        return (
          `<p>${this.#renderLink(attribute('url'), attribute('title'))}` +
          (description ? ` - ${escapeText(description)}` : '') +
          `</p>`
        );
      }

      // Card grids are link lists once the layout is gone.
      case 'cards':
      case 'cardgrid':
        return `<ul>${this.renderChildren(node)}</ul>`;
      case 'card':
      case 'linkcard': {
        const description = attribute('description');
        return (
          `<li>${this.#renderLink(attribute('url') || attribute('href'), attribute('title'))}` +
          (description ? `: ${escapeText(description)}` : '') +
          `</li>`
        );
      }

      case 'badge':
        return `<strong>${escapeText(attribute('text'))}</strong>`;

      // A prompt is meant to be copied verbatim, so keep it preformatted.
      // `{pageUrl}` is substituted on nx.dev with the page's markdown source.
      case 'llm_copy_prompt': {
        const prompt = plainText(node)
          .replaceAll('{pageUrl}', `${this.#options.canonicalUrl}.md`)
          .trim();
        return (
          `<p><strong>${escapeText(attribute('title'))}</strong></p>` +
          `<pre><code>${escapeText(prompt)}</code></pre>`
        );
      }

      // Hidden from human readers on nx.dev; keep it that way here.
      case 'llm_only':
        return '';

      // No static equivalent - point at the page that can render them.
      case 'graph':
      case 'project_details':
      case 'index_page_cards':
        return this.#renderCanonicalPointer(node.tag, attribute('title'));

      default:
        this.warnings.push(`unsupported Markdoc tag "${node.tag}"`);
        return this.renderChildren(node);
    }
  }

  #renderCanonicalPointer(tag: string, title: string): string {
    const labels: Record<string, string> = {
      graph: 'project graph',
      project_details: 'project details view',
      index_page_cards: 'list of related pages',
    };
    const label = title || labels[tag] || tag;
    return (
      `<p><em>This section shows an interactive ${escapeText(label)}. ` +
      `View it on <a href="${escapeAttribute(this.#options.canonicalUrl)}">nx.dev</a>.</em></p>`
    );
  }

  #renderLinkParagraph(href: string, label: string): string {
    return `<p>${this.#renderLink(href, label)}</p>`;
  }

  #renderLink(href: string, label: string): string {
    const url = this.#absolutizeLink(href);
    return `<a href="${escapeAttribute(url)}">${escapeText(label || url)}</a>`;
  }

  /**
   * Pylon serves these articles off help.nx.app, so every in-repo link has to
   * become absolute against nx.dev. Bare fragments resolve against the
   * canonical page rather than the Pylon article, whose heading anchors differ.
   */
  #absolutizeLink(href: string): string {
    if (!href) return this.#options.canonicalUrl;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return href;
    if (href.startsWith('#')) return this.#options.canonicalUrl + href;
    if (href.startsWith('/')) return this.#options.siteUrl + href;

    this.warnings.push(`relative link left unresolved: ${href}`);
    return href;
  }
}

/**
 * Markdoc keeps `<!-- ... -->` as ordinary text, so without this the site's
 * editorial notes and vale directives would show up as article copy. Comments
 * inside fenced blocks are real sample code and must survive.
 */
function stripHtmlComments(source: string): string {
  const lines: string[] = [];
  let openFence: string | null = null;
  let insideComment = false;

  for (const line of source.split('\n')) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/)?.[1];

    if (openFence) {
      lines.push(line);
      if (
        fence &&
        fence[0] === openFence[0] &&
        fence.length >= openFence.length
      ) {
        openFence = null;
      }
      continue;
    }

    if (fence && !insideComment) {
      openFence = fence;
      lines.push(line);
      continue;
    }

    let remaining = line;
    let kept = '';
    while (remaining) {
      if (insideComment) {
        const end = remaining.indexOf('-->');
        if (end === -1) break;
        insideComment = false;
        remaining = remaining.slice(end + '-->'.length);
      } else {
        const start = remaining.indexOf('<!--');
        if (start === -1) {
          kept += remaining;
          break;
        }
        kept += remaining.slice(0, start);
        insideComment = true;
        remaining = remaining.slice(start + '<!--'.length);
      }
    }
    lines.push(kept);
  }

  return lines.join('\n');
}

/**
 * Only `title` and `description` are read; the sync does not map the remaining
 * docs frontmatter (sidebar, filter, topics) onto Pylon fields.
 */
function parseFrontmatter(raw: string): { title: string; description: string } {
  const read = (field: string): string => {
    const match = raw.match(new RegExp(`^${field}:[ \\t]*(.*)$`, 'm'));
    if (!match) return '';
    return match[1].trim().replace(/^['"]|['"]$/g, '');
  };
  return { title: read('title'), description: read('description') };
}

/**
 * Flattens a subtree to text, for content that must survive as a code block.
 * List markers are rebuilt because a numbered prompt reads as instructions.
 */
function plainText(
  node: Node,
  listContext?: { ordered: boolean; index: number }
): string {
  const attributes = (node.attributes ?? {}) as Record<string, unknown>;
  const children = node.children ?? [];

  switch (node.type) {
    case 'text':
    case 'code':
    case 'fence':
      return String(attributes.content ?? '');
    case 'softbreak':
    case 'hardbreak':
      return '\n';
    case 'paragraph':
      return children.map((child) => plainText(child)).join('') + '\n';
    case 'list': {
      const ordered = attributes.ordered === true;
      return (
        children
          .map((child, index) =>
            plainText(child, { ordered, index: index + 1 })
          )
          .join('') + '\n'
      );
    }
    case 'item': {
      const marker = listContext?.ordered ? `${listContext.index}. ` : '- ';
      return (
        marker +
        children
          .map((child) => plainText(child))
          .join('')
          .trimEnd() +
        '\n'
      );
    }
    default:
      return children.map((child) => plainText(child)).join('');
  }
}

/** `{% youtube src="https://youtu.be/ID" %}` also appears in embed form. */
function toYoutubeEmbedUrl(src: string): string {
  const shortLink = src.match(/^https?:\/\/youtu\.be\/([\w-]+)/);
  if (shortLink) return `https://www.youtube.com/embed/${shortLink[1]}`;

  const watchLink = src.match(/[?&]v=([\w-]+)/);
  if (watchLink) return `https://www.youtube.com/embed/${watchLink[1]}`;

  return src;
}

/** List items hold a paragraph per Markdoc; inline them so lists stay tight. */
function unwrapSingleParagraph(html: string): string {
  const match = html.match(/^<p>([\s\S]*?)<\/p>([\s\S]*)$/);
  return match && !match[1].includes('<p>') ? match[1] + match[2] : html;
}

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
