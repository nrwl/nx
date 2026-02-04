import type * as t from '@babel/types';
import type * as parse5 from 'parse5';

export type Parse5Node = parse5.DefaultTreeAdapterMap['node'];
export type Parse5Element = parse5.DefaultTreeAdapterMap['element'];
export type Parse5TextNode = parse5.DefaultTreeAdapterMap['textNode'];
export type Parse5CommentNode = parse5.DefaultTreeAdapterMap['commentNode'];
export type Parse5DocumentFragment = parse5.DefaultTreeAdapterMap['documentFragment'];
export type Parse5Document = parse5.DefaultTreeAdapterMap['document'];
export type Parse5ChildNode = parse5.DefaultTreeAdapterMap['childNode'];
export type Parse5ParentNode = Parse5DocumentFragment | Parse5Element | Parse5Document;

export class Typeguards
{
    public static isElement(node: Parse5Node): node is Parse5Element
    {
        return 'tagName' in node;
    }

    public static isTextNode(node: Parse5Node): node is Parse5TextNode
    {
        return node.nodeName === '#text' && 'value' in node;
    }

    public static isCommentNode(node: Parse5Node): node is Parse5CommentNode
    {
        return node.nodeName === '#comment';
    }

    public static isDocumentFragment(value: unknown): value is Parse5DocumentFragment
    {
        if (typeof value !== 'object' || value === null || !('childNodes' in value) || !('nodeName' in value))
        {
            return false;
        }
        const nodeNameValue = (value as { nodeName: unknown }).nodeName;
        return nodeNameValue === '#document-fragment';
    }

    public static isDocumentFragmentLike(value: unknown): value is Parse5DocumentFragment
    {
        return typeof value === 'object' && value !== null && 'childNodes' in value && 'nodeName' in value;
    }

    public static isRecord(value: unknown): value is Record<string, unknown>
    {
        return value !== null && typeof value === 'object';
    }

    public static isBabelNode(value: unknown): value is t.Node
    {
        return value !== null && typeof value === 'object' && 'type' in value;
    }

    public static isAttrsRecord(value: unknown): value is Record<string, { startOffset: number; endOffset: number }>
    {
        return value !== null && typeof value === 'object';
    }

    public static hasPipeN(value: unknown): value is { n: unknown }
    {
        return value !== null && typeof value === 'object' && 'n' in value;
    }

    public static hasPipeA(value: unknown): value is { a: unknown[] }
    {
        return value !== null && typeof value === 'object' && 'a' in value && Array.isArray((value as {
            a: unknown
        }).a);
    }
}
