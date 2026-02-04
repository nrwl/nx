import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import he from 'he';
import * as parse5 from 'parse5';
import { DomPreProcessor } from './DomPreProcessor.js';
import { ExpressionTransformer } from './ExpressionTransformer.js';
import type { BindingInfo } from './interfaces/BindingInfo.js';
import type { ElementNode } from './interfaces/ElementNode.js';
import type { ForNode } from './interfaces/ForNode.js';
import type { IfBranch } from './interfaces/IfBranch.js';
import type { IfNode } from './interfaces/IfNode.js';
import type { InterpolationNode } from './interfaces/InterpolationNode.js';
import type { ParsedTemplate } from './interfaces/ParsedTemplate.js';
import type { PropertyChain } from './interfaces/PropertyChain.js';
import type { Scope } from './interfaces/Scope.js';
import type { SwitchCase } from './interfaces/SwitchCase.js';
import type { SwitchNode } from './interfaces/SwitchNode.js';
import type { TemplateNode } from './interfaces/TemplateNode.js';
import type { Parse5Element, Parse5Node } from './Typeguards.js';
import { Typeguards } from './Typeguards.js';

export type { BindingInfo } from './interfaces/BindingInfo.js';
export type { BreakNode } from './interfaces/BreakNode.js';
export type { CommentNode } from './interfaces/CommentNode.js';
export type { ControlFlowNode } from './interfaces/ControlFlowNode.js';
export type { ElementNode } from './interfaces/ElementNode.js';
export type { ForNode } from './interfaces/ForNode.js';
export type { IfBranch } from './interfaces/IfBranch.js';
export type { IfNode } from './interfaces/IfNode.js';
export type { InterpolationNode } from './interfaces/InterpolationNode.js';
export type { ParsedTemplate } from './interfaces/ParsedTemplate.js';
export type { PropertyChain } from './interfaces/PropertyChain.js';
export type { Scope } from './interfaces/Scope.js';
export type { SwitchCase } from './interfaces/SwitchCase.js';
export type { SwitchNode } from './interfaces/SwitchNode.js';
export type { TemplateNode } from './interfaces/TemplateNode.js';
export type { TextNode } from './interfaces/TextNode.js';

export class TemplateParser
{
    private bindingId = 0;
    private templateRefs = new Set<string>();
    private scopeStack: Scope[] = [];
    private getterDependencyMap = new Map<string, string[]>();
    private testYieldBeforeGetterDepsLookup: (() => Promise<void>) | null = null;

    public setGetterDependencyMap(map: Map<string, string[]>): void
    {
        this.getterDependencyMap = map;
    }

    public __setTestYieldBeforeGetterDepsLookup(callback: (() => Promise<void>) | null): void
    {
        this.testYieldBeforeGetterDepsLookup = callback;
    }

    public async parse(html: string): Promise<ParsedTemplate>
    {
        this.bindingId = 0;
        this.templateRefs = new Set();
        this.scopeStack = [{ variables: new Set() }];

        const preProcessor = new DomPreProcessor();
        const normalized = await preProcessor.process(html);

        const fragment = parse5.parseFragment(normalized);
        const root = await this.processNodes(fragment.childNodes);

        return {
            root,
            templateRefs: Array.from(this.templateRefs)
        };
    }

    private async processNodes(nodes: Parse5Node[]): Promise<TemplateNode[]>
    {
        const result: TemplateNode[] = [];
        let i = 0;

        while (i < nodes.length)
        {
            const node = nodes[i];

            if (Typeguards.isElement(node) && node.tagName === 'x-fluff-if')
            {
                const ifNode = await this.processConsolidatedIf(nodes, i);
                result.push(ifNode.node);
                i = ifNode.nextIndex;
                continue;
            }

            if (Typeguards.isElement(node) && node.tagName === 'x-fluff-for')
            {
                const forNode = await this.processConsolidatedFor(nodes, i);
                result.push(forNode.node);
                i = forNode.nextIndex;
                continue;
            }

            const processed = await this.processNode(node);
            if (processed)
            {
                result.push(processed);
            }
            i++;
        }

        return result;
    }

    private async processConsolidatedIf(nodes: Parse5Node[], startIndex: number): Promise<{
        node: IfNode;
        nextIndex: number
    }>
    {
        const branches: IfBranch[] = [];
        let i = startIndex;

        while (i < nodes.length)
        {
            const node = nodes[i];

            if (!Typeguards.isElement(node))
            {
                if (Typeguards.isTextNode(node) && node.value.trim() === '')
                {
                    i++;
                    continue;
                }
                break;
            }

            if (node.tagName === 'x-fluff-if' && branches.length === 0)
            {
                const conditionRaw = this.getAttr(node, 'x-fluff-condition') ?? '';
                const children = await this.processNodes(node.childNodes ?? []);
                const conditionDeps = await this.extractDeps(conditionRaw);
                const condition = this.transformWithLocals(conditionRaw);
                branches.push({
                    condition,
                    conditionDeps: conditionDeps.length > 0 ? conditionDeps : undefined,
                    children
                });
                i++;
            }
            else if (node.tagName === 'x-fluff-else-if' && branches.length > 0)
            {
                const conditionRaw = this.getAttr(node, 'x-fluff-condition') ?? '';
                const children = await this.processNodes(node.childNodes ?? []);
                const conditionDeps = await this.extractDeps(conditionRaw);
                const condition = this.transformWithLocals(conditionRaw);
                branches.push({
                    condition,
                    conditionDeps: conditionDeps.length > 0 ? conditionDeps : undefined,
                    children
                });
                i++;
            }
            else if (node.tagName === 'x-fluff-else' && branches.length > 0)
            {
                const children = await this.processNodes(node.childNodes ?? []);
                branches.push({
                    children
                });
                i++;
                break;
            }
            else
            {
                break;
            }
        }

        return {
            node: {
                type: 'if',
                branches,
                localVariables: this.getCurrentLocalVariables()
            },
            nextIndex: i
        };
    }

    private async processConsolidatedFor(nodes: Parse5Node[], startIndex: number): Promise<{
        node: ForNode;
        nextIndex: number
    }>
    {
        const forElement = nodes[startIndex];
        if (!Typeguards.isElement(forElement))
        {
            throw new Error('Expected element node');
        }
        const forNode = await this.processForElement(forElement);

        let i = startIndex + 1;

        while (i < nodes.length)
        {
            const node = nodes[i];

            if (!Typeguards.isElement(node))
            {
                if (Typeguards.isTextNode(node) && node.value.trim() === '')
                {
                    i++;
                    continue;
                }
                break;
            }

            if (node.tagName === 'x-fluff-empty')
            {
                forNode.emptyContent = await this.processNodes(node.childNodes ?? []);
                i++;
                break;
            }
            else
            {
                break;
            }
        }

        return {
            node: forNode,
            nextIndex: i
        };
    }

    private async processNode(node: Parse5Node): Promise<TemplateNode | null>
    {
        if (Typeguards.isElement(node))
        {
            return this.processElement(node);
        }
        else if (Typeguards.isTextNode(node))
        {
            const text = node.value.trim();
            if (text.length === 0)
            {
                return null;
            }
            return { type: 'text', content: node.value };
        }
        else if (Typeguards.isCommentNode(node))
        {
            return { type: 'comment', content: node.data };
        }

        return null;
    }

    private async processElement(element: Parse5Element): Promise<TemplateNode | null>
    {
        const { tagName } = element;

        if (tagName === 'x-fluff-if')
        {
            return null;
        }
        else if (tagName === 'x-fluff-else-if')
        {
            return null;
        }
        else if (tagName === 'x-fluff-else')
        {
            return null;
        }
        else if (tagName === 'x-fluff-for')
        {
            return this.processForElement(element);
        }
        else if (tagName === 'x-fluff-switch')
        {
            return this.processSwitchElement(element);
        }
        else if (tagName === 'x-fluff-case')
        {
            return null;
        }
        else if (tagName === 'x-fluff-default')
        {
            return null;
        }
        else if (tagName === 'x-fluff-empty')
        {
            return null;
        }
        else if (tagName === 'x-fluff-fallthrough')
        {
            return null;
        }
        else if (tagName === 'x-fluff-break')
        {
            return { type: 'break' };
        }
        else if (tagName === 'x-fluff-text')
        {
            return this.processTextElement(element);
        }

        return this.processRegularElement(element);
    }

    private async processForElement(element: Parse5Element): Promise<ForNode>
    {
        const iterator = this.getAttr(element, 'x-fluff-iterator') ?? 'item';
        const iterableRaw = this.getAttr(element, 'x-fluff-iterable') ?? '';
        const trackBy = this.getAttr(element, 'x-fluff-track');
        const iterableDeps = await this.extractDeps(iterableRaw);
        const iterable = this.transformWithLocals(iterableRaw);

        this.pushScope([iterator, '$index']);

        const childNodes = element.childNodes ?? [];
        const children: TemplateNode[] = [];
        let emptyContent: TemplateNode[] | undefined = undefined;

        for (const child of childNodes)
        {
            if (Typeguards.isElement(child) && child.tagName === 'x-fluff-empty')
            {
                emptyContent = await this.processNodes(child.childNodes ?? []);
            }
            else
            {
                const processed = await this.processNode(child);
                if (processed)
                {
                    children.push(processed);
                }
            }
        }

        const localVariables = this.getCurrentLocalVariables();
        this.popScope();

        return {
            type: 'for',
            iterator,
            iterable,
            iterableDeps: iterableDeps.length > 0 ? iterableDeps : undefined,
            trackBy: trackBy ?? undefined,
            emptyContent,
            children,
            localVariables
        };
    }

    private async processSwitchElement(element: Parse5Element): Promise<SwitchNode>
    {
        const expressionRaw = this.getAttr(element, 'x-fluff-expr') ?? '';
        const expressionDeps = await this.extractDeps(expressionRaw);
        const expression = this.transformWithLocals(expressionRaw);
        const cases: SwitchCase[] = [];

        const childNodes = element.childNodes ?? [];
        for (const child of childNodes)
        {
            if (!Typeguards.isElement(child)) continue;

            if (child.tagName === 'x-fluff-case')
            {
                const valueRaw = this.getAttr(child, 'x-fluff-value') ?? '';
                const valueExpression = this.transformWithLocals(valueRaw);
                const caseChildren = await this.processNodes(child.childNodes ?? []);
                const hasFallthrough = this.hasChildElement(child, 'x-fluff-fallthrough');
                const filteredChildren = caseChildren.filter(c =>
                    !(c.type === 'break')
                );

                cases.push({
                    valueExpression,
                    isDefault: false,
                    fallthrough: hasFallthrough,
                    children: filteredChildren
                });
            }
            else if (child.tagName === 'x-fluff-default')
            {
                const caseChildren = await this.processNodes(child.childNodes ?? []);
                const hasFallthrough = this.hasChildElement(child, 'x-fluff-fallthrough');
                const filteredChildren = caseChildren.filter(c =>
                    !(c.type === 'break')
                );

                cases.push({
                    isDefault: true,
                    fallthrough: hasFallthrough,
                    children: filteredChildren
                });
            }
        }

        return {
            type: 'switch',
            expression,
            expressionDeps: expressionDeps.length > 0 ? expressionDeps : undefined,
            cases,
            localVariables: this.getCurrentLocalVariables()
        };
    }

    private hasChildElement(element: Parse5Element, tagName: string): boolean
    {
        for (const child of element.childNodes ?? [])
        {
            if (Typeguards.isElement(child) && child.tagName === tagName)
            {
                return true;
            }
        }
        return false;
    }

    private async processTextElement(element: Parse5Element): Promise<InterpolationNode>
    {
        const expression = this.getAttr(element, 'x-fluff-expr') ?? '';
        const pipesAttr = this.getAttr(element, 'x-fluff-pipes');
        const id = `l${this.bindingId++}`;
        const deps = await this.extractDeps(expression);
        const transformedExpression = this.transformWithLocals(expression, { eventReplacementName: '__ev' });

        const result: InterpolationNode = {
            type: 'interpolation',
            expression: transformedExpression,
            deps: deps.length > 0 ? deps : undefined,
            id
        };

        if (pipesAttr)
        {
            try
            {
                const parsed: unknown = JSON.parse(pipesAttr);
                if (Array.isArray(parsed))
                {
                    result.pipes = this.transformPipes(parsed);
                }
            }
            catch
            {
            }
        }

        return result;
    }

    private async processRegularElement(element: Parse5Element): Promise<ElementNode>
    {
        const bindings: BindingInfo[] = [];
        const attributes: Record<string, string> = {};
        let hasBindings = false;

        for (const attr of element.attrs)
        {
            if (attr.name.startsWith('x-fluff-attrib-'))
            {
                const bindingInfo = await this.parseBindingAttribute(attr.value);
                if (bindingInfo)
                {
                    bindings.push(bindingInfo);
                    hasBindings = true;

                    if (bindingInfo.binding === 'ref')
                    {
                        this.templateRefs.add(bindingInfo.name);
                    }
                }
            }
            else
            {
                attributes[attr.name] = attr.value;
            }
        }

        const children = await this.processNodes(element.childNodes ?? []);

        const node: ElementNode = {
            type: 'element',
            tagName: element.tagName,
            attributes,
            bindings,
            children
        };

        if (hasBindings)
        {
            node.id = `l${this.bindingId++}`;
        }

        return node;
    }

    private async parseBindingAttribute(jsonValue: string): Promise<BindingInfo | null>
    {
        try
        {
            const decoded = he.decode(jsonValue);

            const parsed: unknown = JSON.parse(decoded);
            if (!Typeguards.isRecord(parsed))
            {
                return null;
            }
            if (typeof parsed.name !== 'string' || typeof parsed.binding !== 'string' || typeof parsed.expression !== 'string')
            {
                return null;
            }
            const validBindings: BindingInfo['binding'][] = ['property', 'event', 'class', 'style', 'two-way', 'ref'];
            const binding = validBindings.find(b => b === parsed.binding);
            if (!binding)
            {
                return null;
            }

            const deps = await this.extractDeps(parsed.expression);
            const transformedExpression = this.transformWithLocals(parsed.expression, {
                eventReplacementName: '__ev',
                templateRefs: Array.from(this.templateRefs)
            });

            const result: BindingInfo = {
                name: parsed.name,
                binding,
                expression: transformedExpression,
                deps: deps.length > 0 ? deps : undefined
            };

            if (typeof parsed.subscribe === 'string')
            {
                result.subscribe = parsed.subscribe;
            }

            if (Array.isArray(parsed.pipes))
            {
                result.pipes = this.transformPipes(parsed.pipes);
            }

            return result;
        }
        catch
        {
            return null;
        }
    }

    private getAttr(element: Parse5Element, name: string): string | null
    {
        const attr = element.attrs.find(a => a.name === name);
        return attr ? attr.value : null;
    }

    private transformWithLocals(expression: string, options?: {
        eventReplacementName?: string;
        templateRefs?: string[]
    }): string
    {
        const localVars = this.getCurrentLocalVariables();
        return ExpressionTransformer.transformExpression(expression, {
            addThisPrefix: true,
            localVars,
            localsObjectName: 'l',
            eventReplacementName: options?.eventReplacementName,
            templateRefs: options?.templateRefs
        });
    }

    private transformPipes(pipes: unknown[]): { name: string; args: string[] }[]
    {
        return pipes.map(pipe =>
        {
            if (!Typeguards.isRecord(pipe))
            {
                return null;
            }
            if (typeof pipe.name !== 'string' || !Array.isArray(pipe.args))
            {
                return null;
            }
            const args = pipe.args.filter((arg): arg is string => typeof arg === 'string')
                .map(arg => this.transformWithLocals(arg));
            return {
                name: pipe.name,
                args
            };
        })
            .filter((pipe): pipe is { name: string; args: string[] } => pipe !== null);
    }

    private pushScope(variables: string[]): void
    {
        const parent = this.scopeStack[this.scopeStack.length - 1];
        this.scopeStack.push({
            variables: new Set(variables),
            parent
        });
    }

    private popScope(): void
    {
        if (this.scopeStack.length > 1)
        {
            this.scopeStack.pop();
        }
    }

    private getCurrentLocalVariables(): string[]
    {
        const allVars: string[] = [];
        for (const scope of this.scopeStack)
        {
            for (const v of scope.variables)
            {
                if (!allVars.includes(v))
                {
                    allVars.push(v);
                }
            }
        }
        return allVars;
    }


    private async extractDeps(expression: string): Promise<PropertyChain[]>
    {
        const deps: PropertyChain[] = [];

        try
        {
            const ast = parseExpression(expression);

            const extractChain = (node: t.Node): string[] | null =>
            {
                if (t.isIdentifier(node))
                {
                    return [node.name];
                }
                else if (t.isMemberExpression(node))
                {
                    const objectChain = extractChain(node.object);
                    if (!objectChain) return null;

                    if (node.computed)
                    {
                        if (t.isNumericLiteral(node.property))
                        {
                            return [...objectChain, `[${node.property.value}]`];
                        }
                        else if (t.isStringLiteral(node.property))
                        {
                            return [...objectChain, `[${JSON.stringify(node.property.value)}]`];
                        }
                        else if (t.isIdentifier(node.property))
                        {
                            return [...objectChain, `[${node.property.name}]`];
                        }
                        return null;
                    }
                    else if (t.isIdentifier(node.property))
                    {
                        return [...objectChain, node.property.name];
                    }
                }
                return null;
            };

            const visited = new Set<t.Node>();

            const visitNode = (node: t.Node, skipMemberParts = false): void =>
            {
                if (visited.has(node)) return;
                visited.add(node);

                if (t.isMemberExpression(node))
                {
                    const chain = extractChain(node);
                    if (chain && chain.length > 0)
                    {
                        const simplified: PropertyChain = chain.length === 1 ? chain[0] : chain;
                        const exists = deps.some(d =>
                            JSON.stringify(d) === JSON.stringify(simplified)
                        );
                        if (!exists)
                        {
                            deps.push(simplified);
                        }
                    }
                    return;
                }

                if (t.isIdentifier(node) && !skipMemberParts)
                {
                    const simplified: PropertyChain = node.name;
                    const exists = deps.some(d =>
                        JSON.stringify(d) === JSON.stringify(simplified)
                    );
                    if (!exists)
                    {
                        deps.push(simplified);
                    }
                    return;
                }

                if (!Typeguards.isRecord(node)) return;
                for (const key of Object.keys(node))
                {
                    if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
                    const child = node[key];
                    if (Array.isArray(child))
                    {
                        for (const item of child)
                        {
                            if (Typeguards.isBabelNode(item))
                            {
                                visitNode(item);
                            }
                        }
                    }
                    else if (Typeguards.isBabelNode(child))
                    {
                        visitNode(child);
                    }
                }
            };

            visitNode(ast);
        }
        catch
        {
            // If parsing fails, return empty deps
        }

        if (this.getterDependencyMap.size > 0)
        {
            const expanded: PropertyChain[] = [];
            for (const dep of deps)
            {
                const firstProp = typeof dep === 'string' ? dep : (Array.isArray(dep) ? dep[0] : null);
                if (typeof firstProp === 'string')
                {
                    if (this.testYieldBeforeGetterDepsLookup)
                    {
                        await this.testYieldBeforeGetterDepsLookup();
                    }
                    const getterDeps = this.getterDependencyMap.get(firstProp);
                    if (getterDeps && getterDeps.length > 0)
                    {
                        for (const gd of getterDeps)
                        {
                            if (!expanded.includes(gd))
                            {
                                expanded.push(gd);
                            }
                        }
                        continue;
                    }
                }
                expanded.push(dep);
            }
            return expanded;
        }

        return deps;
    }
}
