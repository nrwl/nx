import { parse } from '@babel/parser';
import * as t from '@babel/types';
import * as parse5 from 'parse5';
import { generate, parseMethodBody } from './BabelHelpers.js';
import { ExpressionTransformer } from './ExpressionTransformer.js';
import type { BreakMarkerConfig } from './interfaces/BreakMarkerConfig.js';
import type { ForMarkerConfig } from './interfaces/ForMarkerConfig.js';
import type { IfMarkerConfig } from './interfaces/IfMarkerConfig.js';
import type { SwitchMarkerConfig } from './interfaces/SwitchMarkerConfig.js';
import type { TextMarkerConfig } from './interfaces/TextMarkerConfig.js';
import { Parse5Helpers } from './Parse5Helpers.js';
import type {
    CommentNode,
    ElementNode,
    ForNode,
    IfNode,
    InterpolationNode,
    ParsedTemplate,
    SwitchNode,
    TemplateNode,
    TextNode
} from './TemplateParser.js';
import type { Parse5DocumentFragment, Parse5Element } from './Typeguards.js';

export type { BreakMarkerConfig } from './interfaces/BreakMarkerConfig.js';
export type { ForMarkerConfig } from './interfaces/ForMarkerConfig.js';
export type { IfMarkerConfig } from './interfaces/IfMarkerConfig.js';
export type { SwitchMarkerConfig } from './interfaces/SwitchMarkerConfig.js';
export type { TextMarkerConfig } from './interfaces/TextMarkerConfig.js';

const RESTRICTED_ELEMENT_PREFIX = 'x-fluff-el-';

export type MarkerConfig = IfMarkerConfig | ForMarkerConfig | SwitchMarkerConfig | TextMarkerConfig | BreakMarkerConfig;

export class CodeGenerator
{
    private readonly componentSelectors: Set<string>;
    private readonly componentSelector: string;
    private static readonly globalExprIdsByExpr = new Map<string, number>();
    private static globalExprs: string[] = [];
    private static readonly globalHandlerIdsByExpr = new Map<string, number>();
    private static globalHandlers: string[] = [];

    private markerId = 0;
    private readonly markerConfigs = new Map<number, MarkerConfig>();
    private readonly usedExprIds: number[] = [];
    private readonly usedHandlerIds: number[] = [];
    private readonly bindingsMap = new Map<string, Record<string, unknown>[]>();
    private rootFragment: Parse5DocumentFragment | null = null;
    private readonly collectedTemplates: Parse5Element[] = [];

    public constructor(componentSelectors: Set<string> = new Set<string>(), componentSelector = '')
    {
        this.componentSelectors = componentSelectors;
        this.componentSelector = componentSelector;
    }

    public static resetGlobalState(): void
    {
        CodeGenerator.globalExprIdsByExpr.clear();
        CodeGenerator.globalExprs = [];
        CodeGenerator.globalHandlerIdsByExpr.clear();
        CodeGenerator.globalHandlers = [];
    }

    public generateRenderMethod(template: ParsedTemplate, styles?: string): string
    {
        this.markerId = 0;
        this.markerConfigs.clear();

        const html = this.generateHtml(template);
        const configJson = JSON.stringify(Array.from(this.markerConfigs.entries()));

        return this.generateRenderMethodFromHtml(html, styles, configJson);
    }

    public generateHtml(template: ParsedTemplate): string
    {
        this.rootFragment = parse5.parseFragment('');
        this.collectedTemplates.length = 0;

        this.renderNodesToParent(template.root, this.rootFragment);

        for (const tpl of this.collectedTemplates)
        {
            tpl.parentNode = this.rootFragment;
            this.rootFragment.childNodes.push(tpl);
        }

        return parse5.serialize(this.rootFragment);
    }

    public generateRenderMethodFromHtml(html: string, styles?: string, markerConfigJson?: string): string
    {
        let content = html;
        if (styles)
        {
            const fragment = parse5.parseFragment(html);
            const styleElement = Parse5Helpers.createElement('style', []);
            Parse5Helpers.appendText(styleElement, styles);
            fragment.childNodes.push(styleElement);
            styleElement.parentNode = fragment;
            content = parse5.serialize(fragment);
        }

        const statements: t.Statement[] = [];

        statements.push(
            t.expressionStatement(
                t.assignmentExpression(
                    '=',
                    t.memberExpression(
                        t.callExpression(
                            t.memberExpression(t.thisExpression(), t.identifier('__getShadowRoot')),
                            []
                        ),
                        t.identifier('innerHTML')
                    ),
                    t.stringLiteral(content)
                )
            )
        );

        if (markerConfigJson)
        {
            statements.push(
                t.expressionStatement(
                    t.callExpression(
                        t.memberExpression(t.thisExpression(), t.identifier('__setMarkerConfigs')),
                        [t.stringLiteral(markerConfigJson)]
                    )
                )
            );
        }

        const program = t.program(statements);
        return generate(program, { compact: false }).code;
    }

    public getMarkerConfigJson(): string
    {
        return JSON.stringify(Array.from(this.markerConfigs.entries()));
    }

    public generateBindingsSetup(): string
    {
        const statements: t.Statement[] = [
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.thisExpression(), t.identifier('__initializeMarkers')),
                    [t.identifier('MarkerManager')]
                )
            ),
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.super(), t.identifier('__setupBindings')),
                    []
                )
            )
        ];

        const program = t.program(statements);
        return generate(program, { compact: false }).code;
    }

    public getBindingsMap(): Record<string, Record<string, unknown>[]>
    {
        return Object.fromEntries(this.bindingsMap.entries());
    }

    public generateExpressionAssignments(): string
    {
        const statements: t.Statement[] = [];

        for (const id of this.usedExprIds)
        {
            const expr = CodeGenerator.globalExprs[id];
            const normalizedExpr = CodeGenerator.normalizeCompiledExpr(expr);
            const arrowFunc = CodeGenerator.buildExpressionArrowFunction(['t', 'l'], normalizedExpr);

            statements.push(
                t.expressionStatement(
                    t.assignmentExpression(
                        '=',
                        t.memberExpression(
                            t.memberExpression(t.identifier('FluffBase'), t.identifier('__e')),
                            t.numericLiteral(id),
                            true
                        ),
                        arrowFunc
                    )
                )
            );
        }

        for (const id of this.usedHandlerIds)
        {
            const handler = CodeGenerator.globalHandlers[id];
            const normalizedHandler = CodeGenerator.normalizeCompiledExpr(handler);
            const arrowFunc = CodeGenerator.buildHandlerArrowFunction(['t', 'l', '__ev'], normalizedHandler);

            statements.push(
                t.expressionStatement(
                    t.assignmentExpression(
                        '=',
                        t.memberExpression(
                            t.memberExpression(t.identifier('FluffBase'), t.identifier('__h')),
                            t.numericLiteral(id),
                            true
                        ),
                        arrowFunc
                    )
                )
            );
        }

        if (statements.length === 0)
        {
            return '';
        }

        const program = t.program(statements);
        return generate(program, { compact: false }).code;
    }

    public static generateGlobalExprTable(): string
    {
        const exprElements = CodeGenerator.globalExprs.map(e =>
        {
            const normalizedExpr = CodeGenerator.normalizeCompiledExpr(e);
            return CodeGenerator.buildExpressionArrowFunction(['t', 'l'], normalizedExpr);
        });

        const handlerElements = CodeGenerator.globalHandlers.map(h =>
        {
            const normalizedHandler = CodeGenerator.normalizeCompiledExpr(h);
            return CodeGenerator.buildHandlerArrowFunction(['t', 'l', '__ev'], normalizedHandler);
        });

        const statements: t.Statement[] = [
            t.expressionStatement(
                t.assignmentExpression(
                    '=',
                    t.memberExpression(t.identifier('FluffBase'), t.identifier('__e')),
                    t.arrayExpression(exprElements)
                )
            ),
            t.expressionStatement(
                t.assignmentExpression(
                    '=',
                    t.memberExpression(t.identifier('FluffBase'), t.identifier('__h')),
                    t.arrayExpression(handlerElements)
                )
            )
        ];

        const program = t.program(statements);
        return generate(program, { compact: false }).code;
    }

    private static buildExpressionArrowFunction(params: string[], bodyExpr: string): t.ArrowFunctionExpression
    {
        const paramNodes = params.map(p => t.identifier(p));
        const exprAst = parse(`(${bodyExpr})`, { sourceType: 'module' });
        const [exprStmt] = exprAst.program.body;
        if (t.isExpressionStatement(exprStmt))
        {
            return t.arrowFunctionExpression(paramNodes, exprStmt.expression);
        }
        return t.arrowFunctionExpression(paramNodes, t.identifier('undefined'));
    }

    private static buildHandlerArrowFunction(params: string[], bodyCode: string): t.ArrowFunctionExpression
    {
        const paramNodes = params.map(p => t.identifier(p));
        const bodyStatements = parseMethodBody(bodyCode);
        return t.arrowFunctionExpression(paramNodes, t.blockStatement(bodyStatements));
    }

    private static normalizeCompiledExpr(expr: string): string
    {
        let result = expr;
        if (result.includes('this'))
        {
            result = ExpressionTransformer.replaceThisExpression(result, 't');
        }
        if (result.includes('$event'))
        {
            result = ExpressionTransformer.renameVariable(result, '$event', '__ev');
        }
        return result;
    }

    private nextMarkerId(): number
    {
        return this.markerId++;
    }

    private renderNodesToParent(nodes: TemplateNode[], parent: Parse5DocumentFragment | Parse5Element): void
    {
        for (const node of nodes)
        {
            this.renderNodeToParent(node, parent);
        }
    }

    private renderNodeToParent(node: TemplateNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        switch (node.type)
        {
            case 'element':
                this.renderElementToParent(node, parent);
                break;
            case 'text':
                this.renderTextToParent(node, parent);
                break;
            case 'interpolation':
                this.renderInterpolationToParent(node, parent);
                break;
            case 'comment':
                this.renderCommentToParent(node, parent);
                break;
            case 'if':
                this.renderIfToParent(node, parent);
                break;
            case 'for':
                this.renderForToParent(node, parent);
                break;
            case 'switch':
                this.renderSwitchToParent(node, parent);
                break;
            case 'break':
                this.renderBreakToParent(parent);
                break;
        }
    }

    private renderElementToParent(node: ElementNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const attrs: { name: string; value: string }[] = [];

        if (this.isComponentTag(node.tagName))
        {
            attrs.push({ name: 'x-fluff-component', value: '' });
        }

        for (const [name, value] of Object.entries(node.attributes))
        {
            attrs.push({ name, value });
        }

        if (node.id)
        {
            attrs.push({ name: 'data-lid', value: node.id });
        }

        if (node.bindings.length > 0)
        {
            if (!node.id)
            {
                throw new Error(`Bindings on <${node.tagName}> require a data-lid`);
            }
            const bindingsPayload = node.bindings.map(b => this.serializeBinding(b));
            this.bindingsMap.set(node.id, bindingsPayload);
        }

        const refBinding = node.bindings.find(binding => binding.binding === 'ref');
        if (refBinding)
        {
            attrs.push({ name: 'data-ref', value: refBinding.name });
        }

        let { tagName } = node;
        if (tagName.startsWith(RESTRICTED_ELEMENT_PREFIX))
        {
            tagName = tagName.slice(RESTRICTED_ELEMENT_PREFIX.length);
        }

        const el = Parse5Helpers.createElement(tagName, attrs);
        Parse5Helpers.appendChild(parent, el);

        this.renderNodesToParent(node.children, el);
    }

    private renderTextToParent(node: TextNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        Parse5Helpers.appendText(parent, node.content);
    }

    private isComponentTag(tagName: string): boolean
    {
        const resolvedTagName = tagName.startsWith(RESTRICTED_ELEMENT_PREFIX)
            ? tagName.slice(RESTRICTED_ELEMENT_PREFIX.length)
            : tagName;
        return this.componentSelectors.has(resolvedTagName);
    }

    private serializeBinding(binding: ElementNode['bindings'][number]): Record<string, unknown>
    {
        const result: Record<string, unknown> = {
            n: binding.name,
            b: binding.binding
        };

        if (binding.binding === 'ref')
        {
            return result;
        }

        if (binding.deps)
        {
            result.d = binding.deps;
        }

        if (binding.subscribe)
        {
            result.s = binding.subscribe;
        }

        if (binding.binding === 'event')
        {
            if (!binding.expression)
            {
                throw new Error(`Event binding for ${binding.name} is missing expression`);
            }
            result.h = this.internHandler(binding.expression);
            return result;
        }

        if (binding.binding === 'two-way')
        {
            if (!binding.expression)
            {
                throw new Error(`Two-way binding for ${binding.name} is missing expression`);
            }
            if (!binding.expression.startsWith('this.'))
            {
                throw new Error(`Two-way binding for ${binding.name} must target a component property`);
            }
            result.t = binding.expression.slice('this.'.length);
        }

        if (!binding.expression)
        {
            throw new Error(`Binding for ${binding.name} is missing expression`);
        }
        result.e = this.internExpression(binding.expression);

        return result;
    }

    private internExpression(expr: string): number
    {
        const existing = CodeGenerator.globalExprIdsByExpr.get(expr);
        if (existing !== undefined)
        {
            if (!this.usedExprIds.includes(existing))
            {
                this.usedExprIds.push(existing);
            }
            return existing;
        }
        const id = CodeGenerator.globalExprs.length;
        CodeGenerator.globalExprs.push(expr);
        CodeGenerator.globalExprIdsByExpr.set(expr, id);
        this.usedExprIds.push(id);
        return id;
    }

    private internHandler(expr: string): number
    {
        const existing = CodeGenerator.globalHandlerIdsByExpr.get(expr);
        if (existing !== undefined)
        {
            if (!this.usedHandlerIds.includes(existing))
            {
                this.usedHandlerIds.push(existing);
            }
            return existing;
        }
        const id = CodeGenerator.globalHandlers.length;
        CodeGenerator.globalHandlers.push(expr);
        CodeGenerator.globalHandlerIdsByExpr.set(expr, id);
        this.usedHandlerIds.push(id);
        return id;
    }

    private renderInterpolationToParent(node: InterpolationNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: TextMarkerConfig = {
            type: 'text',
            exprId: this.internExpression(node.expression),
            deps: node.deps,
            pipes: node.pipes?.map(pipe => ({
                name: pipe.name,
                argExprIds: pipe.args.map(arg => this.internExpression(arg))
            }))
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:text:${id}`);
        Parse5Helpers.appendComment(parent, `/fluff:text:${id}`);
    }

    private renderCommentToParent(node: CommentNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        Parse5Helpers.appendComment(parent, node.content);
    }

    private renderIfToParent(node: IfNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: IfMarkerConfig = {
            type: 'if',
            branches: node.branches.map(b => ({
                exprId: b.condition ? this.internExpression(b.condition) : undefined,
                deps: b.conditionDeps
            }))
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:if:${id}`);

        for (let i = 0; i < node.branches.length; i++)
        {
            const branch = node.branches[i];
            const templateId = `${this.componentSelector}-${id}-${i}`;
            const tpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-branch', value: templateId }]);
            this.renderNodesToParent(branch.children, Parse5Helpers.getTemplateContent(tpl));
            this.collectedTemplates.push(tpl);
        }

        Parse5Helpers.appendComment(parent, `/fluff:if:${id}`);
    }

    private renderForToParent(node: ForNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: ForMarkerConfig = {
            type: 'for',
            iterator: node.iterator,
            iterableExprId: this.internExpression(node.iterable),
            deps: node.iterableDeps,
            trackBy: node.trackBy,
            hasEmpty: !!node.emptyContent
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:for:${id}`);

        const templateId = `${this.componentSelector}-${id}`;
        const tpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-tpl', value: templateId }]);
        this.renderNodesToParent(node.children, Parse5Helpers.getTemplateContent(tpl));
        this.collectedTemplates.push(tpl);

        if (node.emptyContent)
        {
            const emptyTpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-empty', value: templateId }]);
            this.renderNodesToParent(node.emptyContent, Parse5Helpers.getTemplateContent(emptyTpl));
            this.collectedTemplates.push(emptyTpl);
        }

        Parse5Helpers.appendComment(parent, `/fluff:for:${id}`);
    }

    private renderSwitchToParent(node: SwitchNode, parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: SwitchMarkerConfig = {
            type: 'switch',
            expressionExprId: this.internExpression(node.expression),
            deps: node.expressionDeps,
            cases: node.cases.map(c => ({
                valueExprId: c.valueExpression ? this.internExpression(c.valueExpression) : undefined,
                isDefault: c.isDefault,
                fallthrough: c.fallthrough
            }))
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:switch:${id}`);

        for (let i = 0; i < node.cases.length; i++)
        {
            const caseNode = node.cases[i];
            const templateId = `${this.componentSelector}-${id}-${i}`;
            const tpl = Parse5Helpers.createElement('template', [{ name: 'data-fluff-case', value: templateId }]);
            this.renderNodesToParent(caseNode.children, Parse5Helpers.getTemplateContent(tpl));
            this.collectedTemplates.push(tpl);
        }

        Parse5Helpers.appendComment(parent, `/fluff:switch:${id}`);
    }

    private renderBreakToParent(parent: Parse5DocumentFragment | Parse5Element): void
    {
        const id = this.nextMarkerId();
        const config: BreakMarkerConfig = {
            type: 'break'
        };
        this.markerConfigs.set(id, config);

        Parse5Helpers.appendComment(parent, `fluff:break:${id}`);
    }

}

