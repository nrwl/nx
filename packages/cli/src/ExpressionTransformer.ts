import _generate from '@babel/generator';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';

const traverse = _traverse.default ?? _traverse;
const generate = _generate.default ?? _generate;


export interface TransformOptions
{
    addThisPrefix?: boolean;
    nullSafe?: boolean;
    iteratorName?: string;
    iteratorReplacement?: string;
    localVars?: string[];
}

export function transformExpression(expr: string, options: TransformOptions = {}): string
{
    const {
        addThisPrefix: shouldAddThisPrefix = true,
        nullSafe = false,
        iteratorName,
        iteratorReplacement,
        localVars = []
    } = options;

    try
    {
        const ast = parse(`(${expr})`, {
            sourceType: 'module', plugins: ['typescript']
        });

        traverse(ast, {
            Identifier(path)
            {
                const { name } = path.node;

                if (['true', 'false', 'null', 'undefined', 'this'].includes(name))
                {
                    return;
                }

                if (localVars.includes(name))
                {
                    return;
                }

                if (t.isMemberExpression(path.parent) && path.parent.property === path.node && !path.parent.computed)
                {
                    return;
                }

                if (t.isOptionalMemberExpression(path.parent) && path.parent.property === path.node)
                {
                    return;
                }

                if (iteratorName && name === iteratorName && iteratorReplacement)
                {
                    const replacementAst = parse(`(${iteratorReplacement})`, { sourceType: 'module' });
                    const [firstStmt] = replacementAst.program.body;
                    if (!t.isExpressionStatement(firstStmt)) return;
                    const replacementExpr = firstStmt.expression;
                    path.replaceWith(replacementExpr);
                    return;
                }

                if (shouldAddThisPrefix)
                {
                    path.replaceWith(t.memberExpression(t.thisExpression(), t.identifier(name)));
                }
            }
        });

        if (nullSafe)
        {
            traverse(ast, {
                MemberExpression: {
                    exit(path)
                    {
                        const obj = path.node.object;
                        const isThisMember = t.isMemberExpression(obj) && t.isThisExpression(obj.object);
                        const isOptionalChain = t.isOptionalMemberExpression(obj);
                        const isDeepChain = t.isMemberExpression(obj);

                        if (!path.node.optional && (isThisMember || isOptionalChain || isDeepChain))
                        {
                            const prop = path.node.property;
                            if (t.isExpression(prop))
                            {
                                const newNode = t.optionalMemberExpression(path.node.object, prop, path.node.computed, true);
                                path.replaceWith(newNode);
                            }
                        }
                    }
                }
            });
        }

        const output = generate(ast, { compact: true });
        let { code } = output;
        if (code.startsWith('(') && code.endsWith(');'))
        {
            code = code.slice(1, -2);
        }
        else if (code.startsWith('(') && code.endsWith(')'))
        {
            code = code.slice(1, -1);
        }
        code = code.replace(/;+$/, '');
        return code;
    }
    catch(e)
    {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to parse expression "${expr}": ${message}`);
    }
}

export function addThisPrefix(expr: string): string
{
    return transformExpression(expr, { addThisPrefix: true, nullSafe: false });
}

export function addThisPrefixSafe(expr: string): string
{
    return transformExpression(expr, { addThisPrefix: true, nullSafe: true });
}

export function transformForExpression(expr: string, iteratorName: string, iteratorReplacement: string): string
{
    return transformExpression(expr, {
        addThisPrefix: true,
        nullSafe: false,
        iteratorName,
        iteratorReplacement,
        localVars: ['__items', '__idx', '__item']
    });
}

export function transformForExpressionKeepIterator(expr: string, iteratorName: string): string
{
    return transformExpression(expr, {
        addThisPrefix: true, nullSafe: false, localVars: [iteratorName, '__items', '__idx', '__item', '__currentItems']
    });
}

export function parsePipedExpression(expr: string): {
    expression: string; pipes: { name: string; args: string[] }[]
}
{
    let remaining = expr.trim();
    const pipes: { name: string; args: string[] }[] = [];

    while (true)
    {
        let pipeIdx = -1;
        for (let i = remaining.length - 1; i >= 0; i--)
        {
            if (remaining[i] === '|')
            {
                if (remaining[i - 1] === '|' || remaining[i + 1] === '|') continue;

                const left = remaining.slice(0, i)
                    .trim();
                if (!left) continue;

                try
                {
                    parse(left, { sourceType: 'module' });
                    pipeIdx = i;
                    break;
                }
                catch
                {

                }
            }
        }

        if (pipeIdx === -1) break;

        const pipeExpr = remaining.slice(pipeIdx + 1)
            .trim();
        const colonParts = pipeExpr.split(':');
        const pipeName = colonParts[0].trim();
        const args = colonParts.slice(1)
            .map(s => s.trim());

        pipes.unshift({ name: pipeName, args });
        remaining = remaining.slice(0, pipeIdx)
            .trim();
    }

    return { expression: remaining, pipes };
}

export function transformInterpolation(expr: string, iteratorVar?: string): string
{
    const localVars = iteratorVar ? [iteratorVar] : [];

    const { expression: baseExpr, pipes } = parsePipedExpression(expr);

    if (pipes.length > 0)
    {
        let result = transformExpression(baseExpr, { addThisPrefix: true, nullSafe: true, localVars });

        for (const pipe of pipes)
        {
            const argsStr = pipe.args.length > 0 ? ', ' + pipe.args.join(', ') : '';
            result = `this.__pipe('${pipe.name}', ${result}${argsStr})`;
        }

        return `${result} ?? ''`;
    }

    const transformed = transformExpression(expr, { addThisPrefix: true, nullSafe: true, localVars });
    return `${transformed} ?? ''`;
}

export function extractRootIdentifier(expr: string): string | null
{
    try
    {
        const ast = parse(expr, { sourceType: 'module' });
        const [stmt] = ast.program.body;
        if (!t.isExpressionStatement(stmt)) return null;

        let node: t.Node = stmt.expression;

        while (true)
        {
            if (t.isIdentifier(node))
            {
                return node.name;
            }
            else if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node))
            {
                node = node.object;
            }
            else if (t.isCallExpression(node) || t.isOptionalCallExpression(node))
            {
                node = node.callee;
            }
            else if (t.isBinaryExpression(node) || t.isLogicalExpression(node))
            {
                node = node.left;
            }
            else if (t.isUnaryExpression(node))
            {
                node = node.argument;
            }
            else if (t.isConditionalExpression(node))
            {
                node = node.test;
            }
            else
            {
                return null;
            }
        }
    }
    catch(e)
    {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to parse expression "${expr}": ${message}`);
    }
}

export function parseInterpolations(text: string): { start: number; end: number; expr: string }[]
{
    const results: { start: number; end: number; expr: string }[] = [];
    let searchStart = 0;

    while (searchStart < text.length)
    {
        const openIdx = text.indexOf('{{', searchStart);
        if (openIdx === -1) break;

        let foundValid = false;
        for (let closeIdx = openIdx + 3; closeIdx <= text.length; closeIdx++)
        {
            if (text[closeIdx - 2] !== '}' || text[closeIdx - 1] !== '}') continue;

            const candidate = text.slice(openIdx + 2, closeIdx - 2)
                .trim();
            if (!candidate) continue;

            const { expression: baseExpr } = parsePipedExpression(candidate);

            try
            {
                parse(baseExpr, { sourceType: 'module' });
                results.push({
                    start: openIdx, end: closeIdx, expr: candidate
                });
                searchStart = closeIdx;
                foundValid = true;
                break;
            }
            catch
            {

            }
        }

        if (!foundValid)
        {
            searchStart = openIdx + 2;
        }
    }

    return results;
}

export function transformPipedExpression(expr: string, addThisPrefixToExpr = true): string
{
    const { expression, pipes } = parsePipedExpression(expr);

    if (pipes.length === 0)
    {
        return expression;
    }

    let result = addThisPrefixToExpr ? transformExpression(expression, {
        addThisPrefix: true,
        nullSafe: true
    }) : expression;

    for (const pipe of pipes)
    {
        const argsStr = pipe.args.length > 0 ? ', ' + pipe.args.join(', ') : '';
        result = `this.__pipe('${pipe.name}', ${result}${argsStr})`;
    }

    return result;
}

export function renameVariable(expr: string, oldName: string, newName: string): string
{
    try
    {
        const ast = parse(expr, { sourceType: 'module' });

        traverse(ast, {
            Identifier(path)
            {
                if (path.node.name === oldName)
                {
                    if (t.isMemberExpression(path.parent) && path.parent.property === path.node && !path.parent.computed)
                    {
                        return;
                    }
                    path.node.name = newName;
                }
            }
        });

        let { code } = generate(ast, { compact: false });
        if (code.endsWith(';')) code = code.slice(0, -1);
        return code;
    }
    catch(e)
    {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to parse expression "${expr}": ${message}`);
    }
}

export function expressionUsesVariable(expr: string, varName: string): boolean
{
    try
    {
        const ast = parse(expr, { sourceType: 'module' });
        let found = false;

        traverse(ast, {
            Identifier(path)
            {
                if (path.node.name === varName)
                {
                    if (t.isMemberExpression(path.parent) && path.parent.property === path.node && !path.parent.computed)
                    {
                        return;
                    }
                    found = true;
                    path.stop();
                }
            }
        });

        return found;
    }
    catch(e)
    {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to parse expression "${expr}": ${message}`);
    }
}
