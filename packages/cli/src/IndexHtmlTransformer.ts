import { minify } from 'html-minifier-terser';
import * as parse5 from 'parse5';
import { html as parse5Html } from 'parse5';

type Parse5Document = parse5.DefaultTreeAdapterMap['document'];
type Parse5Node = parse5.DefaultTreeAdapterMap['node'];
type Parse5Element = parse5.DefaultTreeAdapterMap['element'];

export interface TransformOptions
{
    jsBundle: string;
    cssBundle?: string;
    gzip?: boolean;
    minify?: boolean;
    liveReload?: boolean;
}

export async function transformIndexHtml(html: string, options: TransformOptions): Promise<string>
{
    const doc = parse5.parse(html);

    const jsSrc = options.gzip ? `${options.jsBundle}.gz` : options.jsBundle;
    const cssSrc = options.cssBundle
        ? (options.gzip ? `${options.cssBundle}.gz` : options.cssBundle)
        : null;

    const head = findElement(doc, 'head');
    const body = findElement(doc, 'body');

    if (head && cssSrc)
    {
        appendChild(head, createLinkElement(cssSrc));
    }

    if (body)
    {
        appendChild(body, createScriptElement(jsSrc));
    }

    let result = parse5.serialize(doc);

    if (options.liveReload)
    {
        result = result.replace('</body>', getLiveReloadScript() + '</body>');
    }

    if (options.minify)
    {
        result = await minify(result, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeEmptyAttributes: true,
            minifyCSS: true,
            minifyJS: true
        });
    }

    return result;
}

function findElement(node: Parse5Node, tagName: string): Parse5Element | null
{
    if (isElement(node) && node.tagName === tagName)
    {
        return node;
    }

    if ('childNodes' in node)
    {
        for (const child of node.childNodes)
        {
            const found = findElement(child, tagName);
            if (found) return found;
        }
    }

    return null;
}

function isElement(node: Parse5Node): node is Parse5Element
{
    return 'tagName' in node;
}

function appendChild(parent: Parse5Element, child: Parse5Element): void
{
    child.parentNode = parent;
    parent.childNodes.push(child);
}

function createLinkElement(href: string): Parse5Element
{
    return {
        nodeName: 'link',
        tagName: 'link',
        attrs: [
            { name: 'rel', value: 'stylesheet' },
            { name: 'href', value: href }
        ],
        childNodes: [],
        namespaceURI: parse5Html.NS.HTML,
        parentNode: null
    };
}

function createScriptElement(src: string): Parse5Element
{
    return {
        nodeName: 'script',
        tagName: 'script',
        attrs: [
            { name: 'type', value: 'module' },
            { name: 'src', value: src }
        ],
        childNodes: [],
        namespaceURI: parse5Html.NS.HTML,
        parentNode: null
    };
}

function getLiveReloadScript(): string
{
    return `<script>new EventSource('/esbuild').addEventListener('change', e => {
    const { added, removed, updated } = JSON.parse(e.data);
    if (!added.length && !removed.length && updated.length === 1) {
        for (const link of document.getElementsByTagName("link")) {
            const url = new URL(link.href);
            if (url.host === location.host && url.pathname === updated[0]) {
                const next = link.cloneNode();
                next.href = updated[0] + '?' + Math.random().toString(36).slice(2);
                next.onload = () => link.remove();
                link.parentNode.insertBefore(next, link.nextSibling);
                return;
            }
        }
    }
    location.reload();
});</script>`;
}
