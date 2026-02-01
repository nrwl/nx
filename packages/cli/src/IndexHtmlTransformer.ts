import he from 'he';
import { minify } from 'html-minifier-terser';
import * as parse5 from 'parse5';
import type { HtmlTransformOptions } from './interfaces/HtmlTransformOptions.js';
import { Parse5Helpers } from './Parse5Helpers.js';
import type { Parse5Node } from './Typeguards.js';
import { Typeguards } from './Typeguards.js';

export type { HtmlTransformOptions } from './interfaces/HtmlTransformOptions.js';

export class IndexHtmlTransformer
{
    private static readonly LIVE_RELOAD_SCRIPT = `(function() {
    let firstEvent = true;
    const es = new EventSource('/esbuild');
    es.addEventListener('change', e => {
        if (firstEvent) {
            firstEvent = false;
            return;
        }
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
    });
})();`;

    public static async transform(html: string, options: HtmlTransformOptions): Promise<string>
    {
        const doc = parse5.parse(html);

        const jsSrc = options.gzScriptTag ? `${options.jsBundle}.gz` : options.jsBundle;
        const cssSrc = options.cssBundle
            ? (options.gzScriptTag ? `${options.cssBundle}.gz` : options.cssBundle)
            : null;

        const head = Parse5Helpers.findElement(doc, 'head');
        const body = Parse5Helpers.findElement(doc, 'body');

        if (head && options.inlineStyles)
        {
            const styleEl = Parse5Helpers.createElement('style', []);
            Parse5Helpers.appendText(styleEl, options.inlineStyles);
            Parse5Helpers.appendChild(head, styleEl);
        }

        if (head && cssSrc)
        {
            const linkEl = Parse5Helpers.createElement('link', [
                { name: 'rel', value: 'stylesheet' },
                { name: 'href', value: cssSrc }
            ]);
            Parse5Helpers.appendChild(head, linkEl);
        }

        if (body)
        {
            const scriptEl = Parse5Helpers.createElement('script', [
                { name: 'type', value: 'module' },
                { name: 'src', value: jsSrc }
            ]);
            Parse5Helpers.appendChild(body, scriptEl);
        }

        if (body && options.liveReload)
        {
            const inlineScriptEl = Parse5Helpers.createElement('script', []);
            Parse5Helpers.appendText(inlineScriptEl, IndexHtmlTransformer.LIVE_RELOAD_SCRIPT);
            Parse5Helpers.appendChild(body, inlineScriptEl);
        }

        if (options.liveReload)
        {
            IndexHtmlTransformer.decodeScriptTextNodes(doc);
        }

        let result = parse5.serialize(doc);

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

    private static decodeScriptTextNodes(node: Parse5Node): void
    {
        Parse5Helpers.walkNodes(node, (n) =>
        {
            if (Typeguards.isElement(n) && n.tagName === 'script')
            {
                for (const child of n.childNodes)
                {
                    if ('value' in child && typeof child.value === 'string')
                    {
                        child.value = he.decode(child.value);
                    }
                }
            }
            return undefined;
        });
    }

}
