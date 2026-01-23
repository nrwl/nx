import * as parse5 from 'parse5';
import { html as parse5Html } from 'parse5';
import { ControlFlowParser } from './ControlFlowParser.js';
import { expressionUsesVariable, parseInterpolations, transformInterpolation } from './ExpressionTransformer.js';
import type { ControlFlow, ParsedTemplate, TemplateBinding } from './types.js';

type Parse5Node = parse5.DefaultTreeAdapterMap['node'];
type Parse5Element = parse5.DefaultTreeAdapterMap['element'];
type Parse5TextNode = parse5.DefaultTreeAdapterMap['textNode'];

export class TemplateParser
{
    private bindingId = 0;
    private bindings: TemplateBinding[] = [];
    private controlFlows: ControlFlow[] = [];
    private readonly controlFlowParser = new ControlFlowParser();
    private templateRefs = new Set<string>();

    public parse(html: string): ParsedTemplate
    {
        this.bindingId = 0;
        this.bindings = [];
        this.controlFlows = [];
        this.templateRefs = new Set();

        let result = html;

        result = this.processControlFlowBlocks(result);

        result = this.processWithParse5(result);

        return {
            html: result,
            bindings: this.bindings,
            controlFlows: this.controlFlows,
            templateRefs: Array.from(this.templateRefs)
        };
    }

    private processControlFlowBlocks(html: string): string
    {
        let result = this.processSwitchBlocksNew(html);
        result = this.processForBlocksNew(result);
        result = this.processIfBlocksNew(result);
        return result;
    }

    private processSwitchBlocksNew(html: string): string
    {
        const { result: parsed, blocks } = this.controlFlowParser.parseSwitchBlocks(html);

        let result = parsed;
        for (let i = 0; i < blocks.length; i++)
        {
            const block = blocks[i];
            if (!block) continue;
            const id = `l${this.bindingId++}`;

            const processedCases = block.cases.map(c => ({
                value: c.value,
                content: this.processControlFlowBlocks(this.processControlFlowContent(c.content))
                    .trim(),
                fallthrough: c.fallthrough
            }));

            this.controlFlows.push({
                id, type: 'switch', expression: block.expression, cases: processedCases
            });

            const placeholder = `__SWITCH_BLOCK_${i}__`;
            const replacement = `<!--${id}--><!--/${id}-->`;
            result = result.replace(placeholder, replacement);
        }
        return result;
    }

    private processForBlocksNew(html: string): string
    {
        const { result: parsed, blocks } = this.controlFlowParser.parseForBlocks(html);

        let result = parsed;
        for (let i = 0; i < blocks.length; i++)
        {
            const block = blocks[i];
            if (!block) continue;
            const id = `l${this.bindingId++}`;

            let content = this.processControlFlowBlocks(block.content);
            content = this.processControlFlowContent(content, block.iterator);

            const trimmedContent = content.trim();
            const isOptionContent = trimmedContent.startsWith('<option');

            this.controlFlows.push({
                id,
                type: 'for',
                iterator: block.iterator,
                iterable: block.iterable,
                trackBy: block.trackBy,
                content: trimmedContent
            });

            const placeholder = `__FOR_BLOCK_${i}__`;
            const replacement = isOptionContent ? `<!--for-${id}--><!--/for-${id}-->` : `<!--${id}--><!--/${id}-->`;
            result = result.replace(placeholder, replacement);
        }
        return result;
    }

    private processIfBlocksNew(html: string): string
    {
        const { result: parsed, blocks } = this.controlFlowParser.parseIfBlocks(html);

        let result = parsed;
        for (let i = 0; i < blocks.length; i++)
        {
            const block = blocks[i];
            if (!block) continue;
            const id = `l${this.bindingId++}`;

            let ifContent = this.processControlFlowBlocks(block.ifContent);
            ifContent = this.processControlFlowContent(ifContent);

            let elseContent = '';
            if (block.elseContent)
            {
                elseContent = this.processControlFlowBlocks(block.elseContent);
                elseContent = this.processControlFlowContent(elseContent);
            }

            this.controlFlows.push({
                id, type: 'if', condition: block.condition, ifContent: ifContent.trim(), elseContent: elseContent.trim()
            });

            const placeholder = `__IF_BLOCK_${i}__`;
            const replacement = `<!--${id}--><!--/${id}-->`;
            result = result.replace(placeholder, replacement);
        }
        return result;
    }

    private processWithParse5(html: string): string
    {
        const fragment = parse5.parseFragment(html, { sourceCodeLocationInfo: true });
        this.walkNodes(fragment.childNodes, html);
        return parse5.serialize(fragment);
    }

    private walkNodes(nodes: Parse5Node[], source: string): void
    {
        for (let i = 0; i < nodes.length; i++)
        {
            const node = nodes[i];
            if (this.isElement(node))
            {
                this.processElement(node, source);
                if (node.childNodes)
                {
                    this.walkNodes(node.childNodes, source);
                }
            }
            else if (this.isTextNode(node))
            {
                const newNodes = this.processTextNode(node);
                if (newNodes.length > 0)
                {
                    nodes.splice(i, 1, ...newNodes);
                    i += newNodes.length - 1;
                }
            }
        }
    }

    private isTextNode(node: Parse5Node): node is Parse5TextNode
    {
        return 'value' in node && !('tagName' in node);
    }

    private processTextNode(textNode: Parse5TextNode, iteratorVar?: string, inControlFlow = false): Parse5Node[]
    {
        const text = textNode.value;

        const interpolations = parseInterpolations(text);

        if (interpolations.length === 0)
        {
            return [textNode];
        }

        const nodes: Parse5Node[] = [];
        let lastIndex = 0;

        for (const { start, end, expr } of interpolations)
        {
            if (start > lastIndex)
            {
                nodes.push(this.createTextNode(text.slice(lastIndex, start)));
            }

            if (inControlFlow)
            {
                const usesIterator = iteratorVar && expressionUsesVariable(expr, iteratorVar);
                const transformed = transformInterpolation(expr, iteratorVar);

                if (usesIterator)
                {
                    nodes.push(this.createTextNode(`\${${transformed}}`));
                }
                else
                {
                    const id = `l${this.bindingId++}`;
                    nodes.push(this.createSpanWithTextBind(transformed, id));
                }
            }
            else
            {
                const id = `l${this.bindingId++}`;
                this.bindings.push({
                    id, type: 'text', expression: expr
                });
                nodes.push(this.createSpanElement(id));
            }

            lastIndex = end;
        }

        if (lastIndex < text.length)
        {
            nodes.push(this.createTextNode(text.slice(lastIndex)));
        }

        return nodes;
    }

    private createTextNode(value: string): Parse5TextNode
    {
        return {
            nodeName: '#text',
            value,
            parentNode: null
        };
    }

    private createSpanElement(id: string): Parse5Element
    {
        return {
            nodeName: 'span',
            tagName: 'span',
            attrs: [{ name: 'data-lid', value: id }],
            childNodes: [],
            namespaceURI: parse5Html.NS.HTML,
            parentNode: null
        };
    }

    private isElement(node: Parse5Node): node is Parse5Element
    {
        return 'tagName' in node;
    }

    private getOriginalAttrName(element: Parse5Element, attr: { name: string }, source: string): string
    {
        const attrLocations = 'sourceCodeLocation' in element && element.sourceCodeLocation &&
        typeof element.sourceCodeLocation === 'object' && 'attrs' in element.sourceCodeLocation
            ? element.sourceCodeLocation.attrs as Record<string, { startOffset: number; endOffset: number }> | undefined
            : undefined;

        if (attrLocations?.[attr.name])
        {
            const loc = attrLocations[attr.name];
            if (loc)
            {
                const [originalName] = source.slice(loc.startOffset, loc.endOffset)
                    .split('=');
                return originalName;
            }
        }
        return attr.name;
    }

    private processElement(element: Parse5Element, source: string): void
    {
        const bindings: Omit<TemplateBinding, 'id'>[] = [];
        const attrsToRemove: string[] = [];

        for (const attr of element.attrs)
        {
            if (attr.name.startsWith('[(') && attr.name.endsWith(')]'))
            {
                const prop = attr.name.slice(2, -2);
                const expr = attr.value;
                bindings.push({ type: 'property', target: prop, expression: expr });
                bindings.push({ type: 'event', eventName: 'input', expression: `${expr} = $event.target.${prop}` });
                attrsToRemove.push(attr.name);
            }
            else if (attr.name.startsWith('[') && attr.name.endsWith(']'))
            {
                const prop = attr.name.slice(1, -1);
                const expr = attr.value;

                if (prop.startsWith('class.'))
                {
                    bindings.push({ type: 'class', className: prop.slice(6), expression: expr });
                }
                else if (prop.startsWith('style.'))
                {
                    bindings.push({ type: 'style', styleProp: prop.slice(6), expression: expr });
                }
                else
                {
                    const dangerousProps = ['innerHTML', 'outerHTML', 'href', 'src'];
                    const isUnsafe = prop.endsWith('.unsafe');
                    const baseProp = isUnsafe ? prop.slice(0, -7) : prop;

                    if (dangerousProps.includes(baseProp) && !isUnsafe)
                    {
                        throw new Error(`XSS Protection: [${prop}] binding is blocked. ` + `Use [${prop}.unsafe] if you understand the security implications ` + 'and have sanitized user input.');
                    }

                    bindings.push({ type: 'property', target: baseProp, expression: expr });
                }
                attrsToRemove.push(attr.name);
            }
            else if (attr.name.startsWith('(') && attr.name.endsWith(')'))
            {
                const eventName = attr.name.slice(1, -1);
                bindings.push({ type: 'event', eventName, expression: attr.value });
                attrsToRemove.push(attr.name);
            }
            else if (attr.name.startsWith('#'))
            {
                const originalName = this.getOriginalAttrName(element, attr, source);
                const refName = originalName.slice(1);
                attrsToRemove.push(attr.name);
                element.attrs.push({ name: 'data-ref', value: refName });
                this.templateRefs.add(refName);
            }
        }

        if (bindings.length > 0)
        {
            const id = `l${this.bindingId++}`;
            element.attrs = element.attrs.filter(a => !attrsToRemove.includes(a.name));
            element.attrs.push({ name: 'data-lid', value: id });

            for (const binding of bindings)
            {
                this.bindings.push({ ...binding, id });
            }
        }
    }


    private processControlFlowContent(html: string, iteratorVar?: string): string
    {
        const fragment = parse5.parseFragment(html, { sourceCodeLocationInfo: true });
        this.walkControlFlowNodes(fragment.childNodes, html, iteratorVar);
        return parse5.serialize(fragment);
    }

    private walkControlFlowNodes(nodes: Parse5Node[], source: string, iteratorVar?: string): void
    {
        for (let i = 0; i < nodes.length; i++)
        {
            const node = nodes[i];
            if (this.isElement(node))
            {
                this.processControlFlowElement(node, source, iteratorVar);
                if (node.childNodes)
                {
                    this.walkControlFlowNodes(node.childNodes, source, iteratorVar);
                }
            }
            else if (this.isTextNode(node))
            {
                const newNodes = this.processTextNode(node, iteratorVar, true);
                if (newNodes.length > 0)
                {
                    nodes.splice(i, 1, ...newNodes);
                    i += newNodes.length - 1;
                }
            }
        }
    }

    private processControlFlowElement(element: Parse5Element, source: string, iteratorVar?: string): void
    {
        for (const attr of element.attrs)
        {
            const originalName = this.getOriginalAttrName(element, attr, source);

            if (attr.name.startsWith('[') && attr.name.endsWith(']'))
            {
                const lowercaseProp = attr.name.slice(1, -1);
                const originalProp = originalName.slice(1, -1); // Remove [ ]
                if (originalProp !== lowercaseProp)
                {
                    attr.value = JSON.stringify([originalProp, attr.value]);
                }
            }
            else if (attr.name.startsWith('(') && attr.name.endsWith(')'))
            {
                const lowercaseEvent = attr.name.slice(1, -1);
                const originalEvent = originalName.slice(1, -1); // Remove ( )
                if (originalEvent !== lowercaseEvent)
                {
                    attr.value = JSON.stringify([originalEvent, attr.value]);
                }
            }
            else if (attr.name.startsWith('#'))
            {
                const refName = originalName.slice(1);
                attr.name = 'data-ref';
                attr.value = refName;
                this.templateRefs.add(refName);
            }

            const interpolations = parseInterpolations(attr.value);
            if (interpolations.length > 0)
            {
                let newValue = '';
                let lastEnd = 0;
                for (const { start, end, expr } of interpolations)
                {
                    newValue += attr.value.slice(lastEnd, start);
                    const transformed = transformInterpolation(expr, iteratorVar);
                    newValue += `\${${transformed}}`;
                    lastEnd = end;
                }
                newValue += attr.value.slice(lastEnd);
                attr.value = newValue;
            }
        }
    }

    private createSpanWithTextBind(expr: string, id: string): Parse5Element
    {
        return {
            nodeName: 'span',
            tagName: 'span',
            attrs: [
                { name: 'data-text-bind', value: expr },
                { name: 'data-lid', value: id }
            ],
            childNodes: [],
            namespaceURI: parse5Html.NS.HTML,
            parentNode: null
        };
    }
}
