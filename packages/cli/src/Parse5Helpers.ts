import type * as parse5 from 'parse5';
import { html as parse5Html } from 'parse5';
import type {
    Parse5ChildNode,
    Parse5Document,
    Parse5DocumentFragment,
    Parse5Element,
    Parse5Node,
    Parse5ParentNode
} from './Typeguards.js';
import { Typeguards } from './Typeguards.js';

export type Parse5NodeVisitor = (node: Parse5Node) => boolean | undefined;

export class Parse5Helpers
{
    public static createElement(tagName: string, attrs: { name: string; value: string }[]): Parse5Element
    {
        const el: Parse5Element = {
            nodeName: tagName,
            tagName,
            attrs,
            childNodes: [],
            namespaceURI: parse5Html.NS.HTML,
            parentNode: null
        };

        if (tagName === 'template')
        {
            const content: Parse5DocumentFragment = {
                nodeName: '#document-fragment',
                childNodes: []
            };
            Reflect.set(el, 'content', content);
        }

        return el;
    }

    public static appendChild(parent: Parse5ParentNode, child: Parse5ChildNode): void
    {
        child.parentNode = parent;
        parent.childNodes.push(child);
    }

    public static appendText(parent: Parse5ParentNode, value: string): void
    {
        if (value.length === 0) return;

        const textNode: parse5.DefaultTreeAdapterMap['textNode'] = {
            nodeName: '#text',
            value,
            parentNode: parent
        };
        parent.childNodes.push(textNode);
    }

    public static appendComment(parent: Parse5ParentNode, data: string): void
    {
        const commentNode: parse5.DefaultTreeAdapterMap['commentNode'] = {
            nodeName: '#comment',
            data,
            parentNode: parent
        };
        parent.childNodes.push(commentNode);
    }

    public static getTemplateContent(tpl: Parse5Element): Parse5DocumentFragment
    {
        const content: unknown = Reflect.get(tpl, 'content');
        if (!Typeguards.isDocumentFragmentLike(content))
        {
            throw new Error('Template element missing content property');
        }
        return content;
    }

    public static createDocument(): Parse5Document
    {
        return {
            nodeName: '#document',
            mode: parse5Html.DOCUMENT_MODE.NO_QUIRKS,
            childNodes: []
        };
    }

    public static walkNodes(node: Parse5Node, visitor: Parse5NodeVisitor): void
    {
        const shouldStop = visitor(node);
        if (shouldStop === true) return;

        if ('childNodes' in node)
        {
            for (const child of node.childNodes)
            {
                Parse5Helpers.walkNodes(child, visitor);
            }
        }
    }

    public static findElement(node: Parse5Node, tagName: string): Parse5Element | null
    {
        if (Typeguards.isElement(node) && node.tagName === tagName)
        {
            return node;
        }

        if ('childNodes' in node)
        {
            for (const child of node.childNodes)
            {
                const found = Parse5Helpers.findElement(child, tagName);
                if (found) return found;
            }
        }

        return null;
    }

    public static removeNonMarkerComments(node: Parse5Node): void
    {
        if (!('childNodes' in node)) return;

        const markerPattern = /^\/?(fluff:(if|for|switch|text|break):\d+)$/;

        node.childNodes = node.childNodes.filter(child =>
        {
            if (Typeguards.isCommentNode(child))
            {
                return markerPattern.test(child.data);
            }
            return true;
        });

        for (const child of node.childNodes)
        {
            Parse5Helpers.removeNonMarkerComments(child);
        }
    }
}
