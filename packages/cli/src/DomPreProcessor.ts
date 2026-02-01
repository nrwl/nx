import { parse } from '@babel/parser';
import * as t from '@babel/types';
import * as parse5 from 'parse5';
import type { Comment, EndTag, StartTag, Text } from 'parse5-sax-parser';
import { SAXParser } from 'parse5-sax-parser';
import { Readable } from 'stream';
import { generate } from './BabelHelpers.js';
import { ErrorHelpers } from './ErrorHelpers.js';
import { ExpressionTransformer } from './ExpressionTransformer.js';
import type { ControlFlowParseResult } from './interfaces/ControlFlowParseResult.js';
import { Parse5Helpers } from './Parse5Helpers.js';
import type { Parse5ChildNode, Parse5Element, Parse5ParentNode } from './Typeguards.js';
import { Typeguards } from './Typeguards.js';

const RESTRICTED_ELEMENTS = ['select', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'colgroup'];

type ControlFlowFrame =
    | { type: 'if'; condition: string }
    | { type: 'else-if'; condition: string }
    | { type: 'else' }
    | { type: 'for'; iterator: string; iterable: string; trackBy?: string }
    | { type: 'switch'; expression: string }
    | { type: 'case'; value: string | null }
    | { type: 'default' }
    | { type: 'empty' };

export class DomPreProcessor
{
    private readonly stack: ControlFlowFrame[] = [];
    private source = '';

    private rootFragment: parse5.DefaultTreeAdapterMap['documentFragment'] | null = null;
    private readonly elementStack: Parse5Element[] = [];

    public async process(html: string): Promise<string>
    {
        this.stack.length = 0;
        this.source = html;
        this.rootFragment = parse5.parseFragment('');
        this.elementStack.length = 0;

        return new Promise((resolve, reject) =>
        {
            const parser = new SAXParser({ sourceCodeLocationInfo: true });

            parser.on('startTag', (token: StartTag) =>
            {
                try
                {
                    this.handleStartTag(token);
                }
                catch(e)
                {
                    reject(ErrorHelpers.toError(e));
                }
            });

            parser.on('endTag', (token: EndTag) =>
            {
                this.handleEndTag(token);
            });

            parser.on('text', (token: Text) =>
            {
                this.handleText(token);
            });

            parser.on('comment', (token: Comment) =>
            {
                this.handleComment(token);
            });

            parser.on('doctype', (token) =>
            {
                this.appendDoctype(token.name ?? 'html');
            });

            parser.on('end', () =>
            {
                if (!this.rootFragment)
                {
                    reject(new Error('Internal error: parse5 root fragment not initialized'));
                    return;
                }
                resolve(parse5.serialize(this.rootFragment));
            });

            parser.on('error', (err) =>
            {
                reject(ErrorHelpers.toError(err));
            });

            const stream = Readable.from([html]);
            stream.pipe(parser);
        });
    }

    private handleStartTag(token: StartTag): void
    {
        let { tagName } = token;

        if (tagName.startsWith('x-fluff'))
        {
            throw new Error(`Security: <${tagName}> tags are reserved and cannot be used in templates`);
        }

        if (RESTRICTED_ELEMENTS.includes(tagName))
        {
            tagName = `x-fluff-el-${tagName}`;
        }

        const subscribeMap = new Map<string, string>();
        const subscribeAttr = token.attrs.find(a => a.name === 'x-fluff-subscribe');

        for (const attr of token.attrs)
        {
            if (attr.name === 'x-fluff-subscribe') continue;
            if (attr.name.startsWith('x-fluff'))
            {
                throw new Error('Security: x-fluff-* attributes are reserved and cannot be used in templates');
            }
        }
        if (subscribeAttr)
        {
            for (const part of subscribeAttr.value.split(','))
            {
                const [bindingName, propName] = part.trim()
                    .split(':');
                if (bindingName && propName)
                {
                    subscribeMap.set(bindingName.trim(), propName.trim());
                }
            }
        }

        const attrs: { name: string; value: string }[] = [];
        for (const attr of token.attrs)
        {
            if (attr.name === 'x-fluff-subscribe') continue;

            const originalName = this.getOriginalAttributeName(token, attr.name);
            const transformed = this.transformAttribute(originalName, attr.value, subscribeMap);

            if (transformed)
            {
                attrs.push({ name: transformed.name, value: transformed.value });
            }
            else
            {
                attrs.push({ name: originalName, value: attr.value });
            }
        }

        const el = Parse5Helpers.createElement(tagName, attrs);
        this.appendNode(el);

        if (!token.selfClosing)
        {
            this.elementStack.push(el);
        }
    }

    private transformAttribute(name: string, value: string, subscribeMap: Map<string, string>): {
        name: string; value: string
    } | null
    {
        if (name.startsWith('[(') && name.endsWith(')]'))
        {
            const propName = name.slice(2, -2);
            const bindingObj: Record<string, string> = {
                name: propName, binding: 'two-way', expression: value
            };
            const subscribeTo = subscribeMap.get(propName);
            if (subscribeTo) bindingObj.subscribe = subscribeTo;
            const json = JSON.stringify(bindingObj);
            return {
                name: `x-fluff-attrib-${propName.toLowerCase()}`, value: json
            };
        }

        if (name.startsWith('[') && name.endsWith(']'))
        {
            const propName = name.slice(1, -1);

            if (propName.startsWith('class.'))
            {
                const className = propName.slice(6);
                const bindingObj: Record<string, string> = {
                    name: className, binding: 'class', expression: value
                };
                const subscribeTo = subscribeMap.get(propName);
                if (subscribeTo) bindingObj.subscribe = subscribeTo;
                const json = JSON.stringify(bindingObj);
                return {
                    name: `x-fluff-attrib-class-${className.toLowerCase()}`, value: json
                };
            }

            if (propName.startsWith('style.'))
            {
                const styleName = propName.slice(6);
                const bindingObj: Record<string, string> = {
                    name: styleName, binding: 'style', expression: value
                };
                const subscribeTo = subscribeMap.get(propName);
                if (subscribeTo) bindingObj.subscribe = subscribeTo;
                const json = JSON.stringify(bindingObj);
                return {
                    name: `x-fluff-attrib-style-${styleName.toLowerCase()}`, value: json
                };
            }

            const bindingObj: Record<string, string> = {
                name: propName, binding: 'property', expression: value
            };
            const subscribeTo = subscribeMap.get(propName);
            if (subscribeTo) bindingObj.subscribe = subscribeTo;
            const json = JSON.stringify(bindingObj);
            return {
                name: `x-fluff-attrib-${propName.toLowerCase()}`, value: json
            };
        }

        if (name.startsWith('(') && name.endsWith(')'))
        {
            const eventName = name.slice(1, -1);
            const json = JSON.stringify({
                name: eventName, binding: 'event', expression: value
            });
            return {
                name: `x-fluff-attrib-${eventName.toLowerCase()}`, value: json
            };
        }

        if (name.startsWith('#'))
        {
            const refName = name.slice(1);
            const json = JSON.stringify({
                name: refName, binding: 'ref', expression: value || refName
            });
            return {
                name: `x-fluff-attrib-ref-${refName.toLowerCase()}`, value: json
            };
        }

        if (value.includes('{{') && value.includes('}}'))
        {
            const expression = this.convertInterpolationToExpression(value);
            const json = JSON.stringify({
                name, binding: 'property', expression
            });
            return {
                name: `x-fluff-attrib-${name.toLowerCase()}`, value: json
            };
        }

        return null;
    }

    private convertInterpolationToExpression(value: string): string
    {
        const parts: t.Expression[] = [];
        let pos = 0;

        while (pos < value.length)
        {
            const startIdx = value.indexOf('{{', pos);
            if (startIdx === -1)
            {
                const remaining = value.slice(pos);
                if (remaining.length > 0)
                {
                    parts.push(t.stringLiteral(remaining));
                }
                break;
            }

            if (startIdx > pos)
            {
                const staticPart = value.slice(pos, startIdx);
                parts.push(t.stringLiteral(staticPart));
            }

            const endIdx = value.indexOf('}}', startIdx);
            if (endIdx === -1)
            {
                parts.push(t.stringLiteral(value.slice(startIdx)));
                break;
            }

            const expr = value.slice(startIdx + 2, endIdx)
                .trim();
            const exprAst = parse(`(${expr})`, { sourceType: 'module' });
            const [exprStmt] = exprAst.program.body;
            if (t.isExpressionStatement(exprStmt))
            {
                parts.push(exprStmt.expression);
            }
            pos = endIdx + 2;
        }

        if (parts.length === 0)
        {
            return '\'\'';
        }

        if (parts.length === 1)
        {
            const program = t.program([t.expressionStatement(parts[0])]);
            return generate(program, { compact: true })
                .code
                .replace(/;$/, '');
        }

        let result: t.Expression = parts[0];
        for (let i = 1; i < parts.length; i++)
        {
            result = t.binaryExpression('+', result, parts[i]);
        }

        const program = t.program([t.expressionStatement(result)]);
        return generate(program, { compact: true })
            .code
            .replace(/;$/, '');
    }

    private handleEndTag(token: EndTag): void
    {
        let { tagName } = token;
        if (RESTRICTED_ELEMENTS.includes(tagName))
        {
            tagName = `x-fluff-el-${tagName}`;
        }

        const top = this.elementStack[this.elementStack.length - 1];
        if (top?.tagName === tagName)
        {
            this.elementStack.pop();
            return;
        }

        for (let i = this.elementStack.length - 1; i >= 0; i--)
        {
            if (this.elementStack[i].tagName === tagName)
            {
                this.elementStack.splice(i);
                return;
            }
        }
    }

    private handleText(token: Text): void
    {
        const { text } = token;
        let pos = 0;

        while (pos < text.length)
        {
            const atIndex = text.indexOf('@', pos);
            const interpolationIndex = text.indexOf('{{', pos);
            const blockEndIndex = text.indexOf('}', pos);

            const nextSpecial = this.findNextSpecial(atIndex, interpolationIndex, blockEndIndex);

            if (nextSpecial === -1)
            {
                this.appendText(text.slice(pos));
                break;
            }

            if (nextSpecial > pos)
            {
                this.appendText(text.slice(pos, nextSpecial));
            }

            if (nextSpecial === interpolationIndex)
            {
                const result = this.parseInterpolation(text, nextSpecial);
                if (result)
                {
                    const attrs: { name: string; value: string }[] = [
                        { name: 'x-fluff-expr', value: result.expression }
                    ];
                    if (result.pipes.length > 0)
                    {
                        attrs.push({ name: 'x-fluff-pipes', value: JSON.stringify(result.pipes) });
                    }
                    const el = Parse5Helpers.createElement('x-fluff-text', attrs);
                    this.appendNode(el);
                    pos = result.endPos;
                }
                else
                {
                    this.appendText('{{');
                    pos = nextSpecial + 2;
                }
            }
            else if (nextSpecial === blockEndIndex)
            {
                if (this.stack.length > 0)
                {
                    const frame = this.stack.pop();
                    if (frame)
                    {
                        const tagName = `x-fluff-${frame.type}`;
                        const top = this.elementStack[this.elementStack.length - 1];
                        if (top?.tagName === tagName)
                        {
                            this.elementStack.pop();
                        }
                    }
                    pos = nextSpecial + 1;
                }
                else
                {
                    this.appendText('}');
                    pos = nextSpecial + 1;
                }
            }
            else if (nextSpecial === atIndex)
            {
                const result = this.parseControlFlow(text, nextSpecial);
                if (result)
                {
                    const el = Parse5Helpers.createElement(result.tagName, result.attrs);
                    this.appendNode(el);
                    if (result.opensBlock)
                    {
                        this.elementStack.push(el);
                    }
                    pos = result.endPos;
                }
                else
                {
                    this.appendText('@');
                    pos = nextSpecial + 1;
                }
            }
            else
            {
                this.appendText(text[pos]);
                pos++;
            }
        }
    }

    private appendNode(node: Parse5ChildNode): void
    {
        if (!this.rootFragment)
        {
            throw new Error('Internal error: parse5 root fragment not initialized');
        }

        const parent: Parse5ParentNode = this.elementStack.length > 0
            ? this.elementStack[this.elementStack.length - 1]
            : this.rootFragment;

        node.parentNode = parent;
        parent.childNodes.push(node);
    }

    private appendText(value: string): void
    {
        if (value.length === 0) return;

        const textNode: parse5.DefaultTreeAdapterMap['textNode'] = {
            nodeName: '#text',
            value,
            parentNode: null
        };
        this.appendNode(textNode);
    }

    private appendDoctype(name: string): void
    {
        if (!this.rootFragment)
        {
            throw new Error('Internal error: parse5 root fragment not initialized');
        }

        const doctypeNode: parse5.DefaultTreeAdapterMap['documentType'] = {
            nodeName: '#documentType',
            name,
            publicId: '',
            systemId: '',
            parentNode: null
        };

        doctypeNode.parentNode = this.rootFragment;
        this.rootFragment.childNodes.push(doctypeNode);
    }


    private findNextSpecial(atIndex: number, interpolationIndex: number, blockEndIndex: number): number
    {
        let min = -1;

        if (atIndex !== -1 && (min === -1 || atIndex < min))
        {
            min = atIndex;
        }
        if (interpolationIndex !== -1 && (min === -1 || interpolationIndex < min))
        {
            min = interpolationIndex;
        }
        if (blockEndIndex !== -1 && (min === -1 || blockEndIndex < min))
        {
            min = blockEndIndex;
        }

        return min;
    }

    private parseInterpolation(text: string, startPos: number): {
        expression: string; endPos: number, pipes: { name: string; args: string[] }[]
    } | null
    {
        const closeIndex = text.indexOf('}}', startPos + 2);
        if (closeIndex === -1)
        {
            return null;
        }

        const exprText = text.slice(startPos + 2, closeIndex)
            .trim();
        if (exprText.length === 0)
        {
            return null;
        }

        const result = ExpressionTransformer.parsePrimaryExpression(exprText);

        return {
            expression: result.expression, endPos: closeIndex + 2, pipes: result.pipes
        };
    }

    private parseControlFlow(text: string, startPos: number): ControlFlowParseResult | null
    {
        const remaining = text.slice(startPos + 1);

        if (remaining.startsWith('if'))
        {
            return this.parseIfStatement(text, startPos);
        }
        else if (remaining.startsWith('else if'))
        {
            return this.parseElseIfStatement(text, startPos);
        }
        else if (remaining.startsWith('else'))
        {
            return this.parseElseStatement(text, startPos);
        }
        else if (remaining.startsWith('for'))
        {
            return this.parseForStatement(text, startPos);
        }
        else if (remaining.startsWith('switch'))
        {
            return this.parseSwitchStatement(text, startPos);
        }
        else if (remaining.startsWith('case'))
        {
            return this.parseCaseStatement(text, startPos);
        }
        else if (remaining.startsWith('default'))
        {
            return this.parseDefaultStatement(text, startPos);
        }
        else if (remaining.startsWith('empty'))
        {
            return this.parseEmptyStatement(text, startPos);
        }
        else if (remaining.startsWith('fallthrough'))
        {
            return this.parseFallthroughStatement(text, startPos);
        }
        else if (remaining.startsWith('break'))
        {
            return this.parseBreakStatement(text, startPos);
        }

        return null;
    }

    private parseExpressionBlockCore(
        text: string,
        startPos: number,
        keywordLength: number
    ): { expression: string; bracePos: number } | null
    {
        const afterKeyword = startPos + 1 + keywordLength;
        const parenStart = this.skipWhitespace(text, afterKeyword);

        if (text[parenStart] !== '(')
        {
            return null;
        }

        const exprStart = parenStart + 1;
        const result = ExpressionTransformer.parsePrimaryExpression(text, exprStart);
        if (!result)
        {
            return null;
        }

        const afterExpr = this.skipWhitespace(text, result.endPos);
        if (text[afterExpr] !== ')')
        {
            return null;
        }

        const bracePos = this.skipWhitespace(text, afterExpr + 1);
        if (text[bracePos] !== '{')
        {
            return null;
        }

        return { expression: result.expression, bracePos };
    }

    private parseSimpleBlockCore(text: string, startPos: number, keywordLength: number): number | null
    {
        const afterKeyword = startPos + 1 + keywordLength;
        const bracePos = this.skipWhitespace(text, afterKeyword);

        if (text[bracePos] !== '{')
        {
            return null;
        }

        return bracePos;
    }

    private parseIfStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const result = this.parseExpressionBlockCore(text, startPos, 2);
        if (!result) return null;

        this.stack.push({ type: 'if', condition: result.expression });

        return {
            tagName: 'x-fluff-if',
            attrs: [{ name: 'x-fluff-condition', value: result.expression }],
            endPos: result.bracePos + 1,
            opensBlock: true
        };
    }

    private parseElseIfStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const result = this.parseExpressionBlockCore(text, startPos, 7);
        if (!result) return null;

        this.stack.push({ type: 'else-if', condition: result.expression });

        return {
            tagName: 'x-fluff-else-if',
            attrs: [{ name: 'x-fluff-condition', value: result.expression }],
            endPos: result.bracePos + 1,
            opensBlock: true
        };
    }

    private parseElseStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const bracePos = this.parseSimpleBlockCore(text, startPos, 4);
        if (bracePos === null) return null;

        this.stack.push({ type: 'else' });

        return {
            tagName: 'x-fluff-else',
            attrs: [],
            endPos: bracePos + 1,
            opensBlock: true
        };
    }

    private parseForStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const afterKeyword = startPos + 1 + 3;
        const parenStart = this.skipWhitespace(text, afterKeyword);

        if (text[parenStart] !== '(')
        {
            return null;
        }

        const result = this.parseForContent(text, parenStart + 1);
        if (!result)
        {
            return null;
        }

        const afterExpr = this.skipWhitespace(text, result.endPos);
        if (text[afterExpr] !== ')')
        {
            return null;
        }

        const bracePos = this.skipWhitespace(text, afterExpr + 1);
        if (text[bracePos] !== '{')
        {
            return null;
        }

        this.stack.push({ type: 'for', iterator: result.iterator, iterable: result.iterable, trackBy: result.trackBy });

        const attrs: { name: string; value: string }[] = [
            { name: 'x-fluff-iterator', value: result.iterator },
            { name: 'x-fluff-iterable', value: result.iterable }
        ];
        if (result.trackBy)
        {
            attrs.push({ name: 'x-fluff-track', value: result.trackBy });
        }

        return {
            tagName: 'x-fluff-for',
            attrs,
            endPos: bracePos + 1,
            opensBlock: true
        };
    }

    private parseSwitchStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const result = this.parseExpressionBlockCore(text, startPos, 6);
        if (!result) return null;

        this.stack.push({ type: 'switch', expression: result.expression });

        return {
            tagName: 'x-fluff-switch',
            attrs: [{ name: 'x-fluff-expr', value: result.expression }],
            endPos: result.bracePos + 1,
            opensBlock: true
        };
    }

    private parseCaseStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const result = this.parseExpressionBlockCore(text, startPos, 4);
        if (!result) return null;

        this.stack.push({ type: 'case', value: result.expression });

        return {
            tagName: 'x-fluff-case',
            attrs: [{ name: 'x-fluff-value', value: result.expression }],
            endPos: result.bracePos + 1,
            opensBlock: true
        };
    }

    private parseDefaultStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const bracePos = this.parseSimpleBlockCore(text, startPos, 7);
        if (bracePos === null) return null;

        this.stack.push({ type: 'default' });

        return {
            tagName: 'x-fluff-default',
            attrs: [],
            endPos: bracePos + 1,
            opensBlock: true
        };
    }

    private parseEmptyStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        const bracePos = this.parseSimpleBlockCore(text, startPos, 5);
        if (bracePos === null) return null;

        this.stack.push({ type: 'empty' });

        return {
            tagName: 'x-fluff-empty',
            attrs: [],
            endPos: bracePos + 1,
            opensBlock: true
        };
    }

    private parseSimpleStatement(startPos: number, keywordLength: number, tagName: string): ControlFlowParseResult
    {
        return {
            tagName,
            attrs: [],
            endPos: startPos + 1 + keywordLength,
            opensBlock: false
        };
    }

    private parseFallthroughStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        return this.parseSimpleStatement(startPos, 11, 'x-fluff-fallthrough');
    }

    private parseBreakStatement(text: string, startPos: number): ControlFlowParseResult | null
    {
        return this.parseSimpleStatement(startPos, 5, 'x-fluff-break');
    }

    private parseForContent(text: string, startPos: number): {
        iterator: string; iterable: string; trackBy?: string; endPos: number
    } | null
    {
        let pos = this.skipWhitespace(text, startPos);

        const iteratorMatch = /^([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(text.slice(pos));
        if (!iteratorMatch)
        {
            return null;
        }

        const [, iterator] = iteratorMatch;
        pos += iterator.length;
        pos = this.skipWhitespace(text, pos);

        if (!text.slice(pos)
            .startsWith('of '))
        {
            return null;
        }
        pos += 3;

        const iterableResult = ExpressionTransformer.parsePrimaryExpression(text, pos);
        if (!iterableResult)
        {
            return null;
        }

        const iterable = iterableResult.expression.trim();
        pos = iterableResult.endPos;

        let trackBy: string | undefined = undefined;
        const afterIterable = this.skipWhitespace(text, pos);

        if (text.slice(afterIterable)
            .startsWith('; track ')) // TODO: SPACING SENSITIVE - SHITTY CODE - FIX
        {
            pos = afterIterable + 8;
            const trackResult = ExpressionTransformer.parsePrimaryExpression(text, pos);
            if (trackResult)
            {
                trackBy = trackResult.expression.trim();
                pos = trackResult.endPos;
            }
        }
        else
        {
            pos = afterIterable;
        }

        return { iterator, iterable, trackBy, endPos: pos };
    }


    private skipWhitespace(text: string, pos: number): number
    {
        while (pos < text.length && /\s/.test(text[pos]))
        {
            pos++;
        }
        return pos;
    }

    private handleComment(token: Comment): void
    {
        const commentNode: parse5.DefaultTreeAdapterMap['commentNode'] = {
            nodeName: '#comment',
            data: token.text,
            parentNode: null
        };
        this.appendNode(commentNode);
    }

    private getOriginalAttributeName(token: StartTag, lowercaseName: string): string
    {
        const loc = token.sourceCodeLocation;
        if (!loc || !('attrs' in loc) || !Typeguards.isAttrsRecord(loc.attrs))
        {
            return lowercaseName;
        }

        const attrLoc = loc.attrs[lowercaseName];
        if (!attrLoc)
        {
            return lowercaseName;
        }

        const attrSource = this.source.slice(attrLoc.startOffset, attrLoc.endOffset);
        const eqIndex = attrSource.indexOf('=');
        if (eqIndex === -1)
        {
            return attrSource.trim();
        }
        return attrSource.slice(0, eqIndex)
            .trim();
    }


}
