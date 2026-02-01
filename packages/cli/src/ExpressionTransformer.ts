import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { generate, traverse } from './BabelHelpers.js';
import { ErrorHelpers } from './ErrorHelpers.js';
import type { BabelToken } from './interfaces/BabelToken.js';
import type { TokenizeResult } from './interfaces/TokenizeResult.js';
import type { TransformOptions } from './interfaces/TransformOptions.js';

export type { TransformOptions } from './interfaces/TransformOptions.js';

export class ExpressionTransformer
{
    private static readonly RESERVED_KEYWORDS = [
        'true', 'false', 'null', 'undefined', 'this',
        'void', 'typeof', 'delete', 'new', 'instanceof', 'in',
        'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'throw',
        'try', 'catch', 'finally', 'function', 'class', 'extends', 'super',
        'import', 'export', 'default', 'const', 'let', 'var', 'async', 'await', 'yield',
        'debugger', 'with',
        '$event'
    ];

    private static readonly GLOBAL_OBJECTS = [
        'Array', 'Object', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
        'Math', 'Date', 'JSON', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet',
        'Promise', 'Proxy', 'Reflect', 'Intl',
        'console', 'window', 'document', 'navigator', 'location', 'history',
        'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
        'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
        'encodeURIComponent', 'decodeURIComponent', 'atob', 'btoa',
        'Infinity', 'NaN', 'globalThis'
    ];

    public static transformExpression(expr: string, options: TransformOptions = {}): string
    {
        const {
            addThisPrefix: shouldAddThisPrefix = true,
            nullSafe = false,
            iteratorName,
            iteratorReplacement,
            localVars = [],
            localsObjectName,
            eventReplacementName,
            templateRefs = []
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

                    if (localsObjectName && name === localsObjectName)
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

                    if (t.isObjectProperty(path.parent) && path.parent.key === path.node && !path.parent.computed)
                    {
                        return;
                    }

                    if (name === '$event' && eventReplacementName)
                    {
                        path.replaceWith(t.identifier(eventReplacementName));
                        return;
                    }

                    if (eventReplacementName && name === eventReplacementName)
                    {
                        return;
                    }

                    if (ExpressionTransformer.RESERVED_KEYWORDS.includes(name) || ExpressionTransformer.GLOBAL_OBJECTS.includes(name))
                    {
                        return;
                    }

                    if (localVars.includes(name))
                    {
                        if (localsObjectName)
                        {
                            path.replaceWith(t.memberExpression(t.identifier(localsObjectName), t.identifier(name)));
                        }
                        return;
                    }

                    if (templateRefs.includes(name))
                    {
                        path.replaceWith(
                            t.callExpression(
                                t.memberExpression(
                                    t.callExpression(
                                        t.memberExpression(t.thisExpression(), t.identifier('__getShadowRoot')),
                                        []
                                    ),
                                    t.identifier('querySelector')
                                ),
                                [t.stringLiteral(`[data-ref="${name}"]`)]
                            )
                        );
                        return;
                    }

                    if (t.isObjectProperty(path.parent) && path.parent.shorthand && path.parent.value === path.node)
                    {
                        const grandParent = path.parentPath?.parentPath?.node;
                        if (grandParent && t.isObjectPattern(grandParent))
                        {
                            return;
                        }
                    }

                    const collectFunctionParams = (startPath: typeof path): Set<string> =>
                    {
                        const params = new Set<string>();
                        let cur = startPath.parentPath;

                        while (cur !== null)
                        {
                            if (t.isArrowFunctionExpression(cur.node) || t.isFunctionExpression(cur.node) || t.isFunctionDeclaration(cur.node))
                            {
                                for (const param of cur.node.params)
                                {
                                    if (t.isIdentifier(param))
                                    {
                                        params.add(param.name);
                                    }
                                    else if (t.isAssignmentPattern(param) && t.isIdentifier(param.left))
                                    {
                                        params.add(param.left.name);
                                    }
                                    else if (t.isRestElement(param) && t.isIdentifier(param.argument))
                                    {
                                        params.add(param.argument.name);
                                    }
                                }
                            }
                            const next = cur.parentPath;
                            if (next === null)
                            {
                                break;
                            }
                            cur = next;
                        }

                        return params;
                    };

                    if (collectFunctionParams(path)
                        .has(name))
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

            code = code.replace(/;+$/, '');

            const isWrappedParens = (s: string): boolean =>
            {
                if (!s.startsWith('(') || !s.endsWith(')')) return false;
                let depth = 0;
                for (let i = 0; i < s.length; i++)
                {
                    if (s[i] === '(') depth++;
                    else if (s[i] === ')') depth--;
                    if (depth === 0 && i < s.length - 1) return false;
                }
                return depth === 0;
            };

            if (isWrappedParens(code))
            {
                code = code.slice(1, -1);
            }

            return code;
        }
        catch(e)
        {
            const message = ErrorHelpers.getErrorMessage(e);
            throw new Error(`Failed to parse expression "${expr}": ${message}`);
        }
    }

    public static addThisPrefix(expr: string): string
    {
        return ExpressionTransformer.transformExpression(expr, { addThisPrefix: true, nullSafe: false });
    }

    public static addThisPrefixSafe(expr: string): string
    {
        return ExpressionTransformer.transformExpression(expr, { addThisPrefix: true, nullSafe: true });
    }

    public static transformForExpression(expr: string, iteratorName: string, iteratorReplacement: string): string
    {
        return ExpressionTransformer.transformExpression(expr, {
            addThisPrefix: true,
            nullSafe: false,
            iteratorName,
            iteratorReplacement,
            localVars: ['__items', '__idx', '__item']
        });
    }

    public static transformForExpressionKeepIterator(expr: string, iteratorName: string): string
    {
        return ExpressionTransformer.transformExpression(expr, {
            addThisPrefix: true,
            nullSafe: false,
            localVars: [iteratorName, '__items', '__idx', '__item', '__currentItems']
        });
    }

    private static hasTokens(ast: unknown): ast is { tokens: BabelToken[] }
    {
        return ast !== null && typeof ast === 'object' && 'tokens' in ast && Array.isArray((ast as {
            tokens: unknown
        }).tokens);
    }

    private static hasLocIndex(e: unknown): e is { loc: { index: number } }
    {
        if (e === null || typeof e !== 'object' || !('loc' in e)) return false;
        const { loc } = e as { loc: unknown };
        return loc !== null && typeof loc === 'object' && 'index' in loc && typeof (loc as {
            index: unknown
        }).index === 'number';
    }

    private static tokenizeExpression(code: string, startPos = 0): TokenizeResult
    {
        const substring = code.slice(startPos);
        let tokens: BabelToken[] = [];

        try
        {
            const ast = parse(substring, {
                sourceType: 'module',
                tokens: true
            });
            if (ExpressionTransformer.hasTokens(ast))
            {
                ({ tokens } = ast);
            }
        }
        catch(e: unknown)
        {
            if (ExpressionTransformer.hasLocIndex(e))
            {
                const partialCode = substring.substring(0, e.loc.index);
                try
                {
                    const partialAst = parse(partialCode, {
                        sourceType: 'module',
                        tokens: true
                    });
                    if (ExpressionTransformer.hasTokens(partialAst))
                    {
                        ({ tokens } = partialAst);
                    }
                }
                catch
                {
                    return { index: startPos, tokenCount: 0, stopReason: 'end' };
                }
            }
        }

        let depth = 0;
        let stopIndex = substring.length;
        let stopReason: TokenizeResult['stopReason'] = 'end';
        let tokenCount = 0;

        for (let i = 0; i < tokens.length; i++)
        {
            const token = tokens[i];

            if (token.type.label === '(' || token.type.label === '[' || token.type.label === '{' || token.type.label === '${')
            {
                depth++;
            }
            if (token.type.label === ')' || token.type.label === ']' || token.type.label === '}')
            {
                depth--;
            }

            if (depth < 0)
            {
                stopIndex = token.start;
                stopReason = 'negative_depth';
                tokenCount = i;
                break;
            }

            if (depth === 0 && (token.type.label === '|' || token.type.label === ';' || token.type.label === ':'))
            {
                stopIndex = token.start;
                stopReason = 'delimiter';
                tokenCount = i;
                break;
            }

            tokenCount = i + 1;
        }

        if (stopReason === 'end' && tokens.length > 0)
        {
            stopIndex = tokens[tokens.length - 1].end;
        }

        return { index: startPos + stopIndex, tokenCount, stopReason };
    }

    public static parseSecondaryExpression(input: string, startPos = 0): {
        expression: string;
        endPos: number;
    } | null
    {
        const substring = input.slice(startPos);

        try
        {
            parse(substring, { sourceType: 'module' });
            return {
                expression: substring.trim(),
                endPos: input.length
            };
        }
        catch(e: unknown)
        {
            if (!(e instanceof Error) || !('pos' in e))
            {
                return null;
            }
            const errorPos = typeof e.pos === 'number' ? e.pos : null;
            if (errorPos === null || errorPos === 0)
            {
                return null;
            }

            const candidate = substring.slice(0, errorPos)
                .trim();

            if (candidate.length === 0)
            {
                return null;
            }

            try
            {
                parse(candidate, { sourceType: 'module' });
                return {
                    expression: candidate,
                    endPos: startPos + errorPos
                };
            }
            catch
            {
                return null;
            }
        }
    }

    private static parsePipeIdentifier(str: string, startPos: number): { name: string; endPos: number } | null
    {
        let pos = startPos;
        while (pos < str.length && /\s/.test(str[pos]))
        {
            pos++;
        }

        if (pos >= str.length) return null;

        const firstChar = str[pos];
        if (!/[a-zA-Z_$]/.test(firstChar)) return null;

        let name = firstChar;
        pos++;

        while (pos < str.length && /[a-zA-Z0-9_$]/.test(str[pos]))
        {
            name += str[pos];
            pos++;
        }

        return { name, endPos: pos };
    }

    public static parsePrimaryExpression(text: string, startPos?: number): {
        expression: string;
        pipes: { name: string; args: string[] }[];
        endPos: number;
    }
    {
        const offset = startPos ?? 0;
        const pipes: { name: string; args: string[] }[] = [];

        const tokenResult = ExpressionTransformer.tokenizeExpression(text, offset);

        if (tokenResult.tokenCount === 0)
        {
            return {
                expression: text.slice(offset)
                    .trim(), pipes: [], endPos: text.length
            };
        }

        const baseCandidate = text.slice(offset, tokenResult.index)
            .trim();
        const baseResult = ExpressionTransformer.parseSecondaryExpression(baseCandidate);
        if (!baseResult)
        {
            return { expression: baseCandidate, pipes: [], endPos: tokenResult.index };
        }

        const baseExpression = baseResult.expression;

        if (tokenResult.stopReason !== 'delimiter')
        {
            return { expression: baseExpression, pipes: [], endPos: tokenResult.index };
        }

        const delimChar = text[tokenResult.index];
        if (delimChar !== '|')
        {
            return { expression: baseExpression, pipes: [], endPos: tokenResult.index };
        }

        let pos = tokenResult.index + 1;
        while (pos < text.length)
        {
            const pipeId = ExpressionTransformer.parsePipeIdentifier(text, pos);
            if (!pipeId || pipeId.name.length === 0) break;

            const pipeName = pipeId.name;
            const args: string[] = [];
            pos = pipeId.endPos;

            while (pos < text.length && /\s/.test(text[pos]))
            {
                pos++;
            }

            while (pos < text.length && text[pos] === ':')
            {
                pos++;

                while (pos < text.length && /\s/.test(text[pos]))
                {
                    pos++;
                }

                const prefix = `_arg${args.length + 1}=`;
                const argText = prefix + text.slice(pos);
                const argTokenResult = ExpressionTransformer.tokenizeExpression(argText, 0);
                const argEndPos = argTokenResult.index - prefix.length;

                if (argTokenResult.tokenCount > 0)
                {
                    const argCandidate = text.slice(pos, pos + argEndPos)
                        .trim();
                    const argParsed = ExpressionTransformer.parseSecondaryExpression(argCandidate);
                    if (argParsed)
                    {
                        args.push(argParsed.expression);
                    }
                    else
                    {
                        args.push(argCandidate);
                    }
                    pos = pos + argEndPos;

                    if (argTokenResult.stopReason === 'delimiter' && argText[argTokenResult.index] === '|')
                    {
                        break;
                    }
                }
                else
                {
                    break;
                }
            }

            pipes.push({ name: pipeName, args });

            while (pos < text.length && /\s/.test(text[pos]))
            {
                pos++;
            }

            if (pos < text.length && text[pos] === '|')
            {
                pos++;
            }
            else
            {
                break;
            }
        }

        return { expression: baseExpression, pipes, endPos: pos };
    }

    public static transformInterpolation(expr: string, iteratorVar?: string): string
    {
        const localVars = iteratorVar ? [iteratorVar] : [];

        const { expression: baseExpr, pipes } = ExpressionTransformer.parsePrimaryExpression(expr);

        if (pipes.length > 0)
        {
            const resultStr = ExpressionTransformer.transformExpression(baseExpr, {
                addThisPrefix: true,
                nullSafe: true,
                localVars
            });

            let resultExpr = ExpressionTransformer.parseExpressionToAst(resultStr);

            for (const pipe of pipes)
            {
                const transformedArgs = pipe.args.map(arg =>
                    ExpressionTransformer.parseExpressionToAst(
                        ExpressionTransformer.transformExpression(arg, {
                            addThisPrefix: true,
                            nullSafe: true,
                            localVars
                        })
                    )
                );

                resultExpr = t.callExpression(
                    t.memberExpression(t.thisExpression(), t.identifier('__pipe')),
                    [t.stringLiteral(pipe.name), resultExpr, ...transformedArgs]
                );
            }

            const nullishExpr = t.logicalExpression('??', resultExpr, t.stringLiteral(''));
            return generate(t.program([t.expressionStatement(nullishExpr)]), { compact: true })
                .code
                .replace(/;$/, '');
        }

        const transformed = ExpressionTransformer.transformExpression(expr, {
            addThisPrefix: true,
            nullSafe: true,
            localVars
        });

        const transformedExpr = ExpressionTransformer.parseExpressionToAst(transformed);
        const nullishExpr = t.logicalExpression('??', transformedExpr, t.stringLiteral(''));
        return generate(t.program([t.expressionStatement(nullishExpr)]), { compact: true })
            .code
            .replace(/;$/, '');
    }

    private static parseExpressionToAst(expr: string): t.Expression
    {
        const ast = parse(`(${expr})`, { sourceType: 'module' });
        const [stmt] = ast.program.body;
        if (t.isExpressionStatement(stmt))
        {
            return stmt.expression;
        }
        return t.identifier('undefined');
    }

    public static extractRootIdentifier(expr: string): string | null
    {
        try
        {
            const ast = parse(`(${expr})`, { sourceType: 'module' });
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
                else if (t.isAwaitExpression(node))
                {
                    node = node.argument;
                }
                else if (t.isAssignmentExpression(node))
                {
                    node = node.left;
                }
                else if (t.isParenthesizedExpression(node))
                {
                    node = node.expression;
                }
                else if (t.isObjectExpression(node))
                {
                    let foundSpread: t.SpreadElement | undefined = undefined;
                    for (const prop of node.properties)
                    {
                        if (t.isSpreadElement(prop))
                        {
                            foundSpread = prop;
                            break;
                        }
                    }
                    if (foundSpread)
                    {
                        node = foundSpread.argument;
                    }
                    else
                    {
                        return null;
                    }
                }
                else
                {
                    return null;
                }
            }
        }
        catch(e)
        {
            const message = ErrorHelpers.getErrorMessage(e);
            throw new Error(`Failed to parse expression "${expr}": ${message}`);
        }
    }

    public static parseInterpolations(text: string): { start: number; end: number; expr: string }[]
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

                const { expression: baseExpr } = ExpressionTransformer.parsePrimaryExpression(candidate);

                try
                {
                    parse(`(${baseExpr})`, { sourceType: 'module' });
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

    public static transformPipedExpression(expr: string, addThisPrefixToExpr = true): string
    {
        const { expression, pipes } = ExpressionTransformer.parsePrimaryExpression(expr);

        if (pipes.length === 0)
        {
            return expression;
        }

        const resultStr = addThisPrefixToExpr ? ExpressionTransformer.transformExpression(expression, {
            addThisPrefix: true,
            nullSafe: true
        }) : expression;

        let resultExpr = ExpressionTransformer.parseExpressionToAst(resultStr);

        for (const pipe of pipes)
        {
            const transformedArgs = addThisPrefixToExpr
                ? pipe.args.map(arg => ExpressionTransformer.parseExpressionToAst(
                    ExpressionTransformer.transformExpression(arg, {
                        addThisPrefix: true,
                        nullSafe: true
                    })
                ))
                : pipe.args.map(arg => ExpressionTransformer.parseExpressionToAst(arg));

            resultExpr = t.callExpression(
                t.memberExpression(t.thisExpression(), t.identifier('__pipe')),
                [t.stringLiteral(pipe.name), resultExpr, ...transformedArgs]
            );
        }

        return generate(t.program([t.expressionStatement(resultExpr)]), { compact: true })
            .code
            .replace(/;$/, '');
    }

    public static renameVariable(expr: string, oldName: string, newName: string): string
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
            const message = ErrorHelpers.getErrorMessage(e);
            throw new Error(`Failed to parse expression "${expr}": ${message}`);
        }
    }

    public static expressionUsesVariable(expr: string, varName: string): boolean
    {
        try
        {
            const { expression: baseExpr } = ExpressionTransformer.parsePrimaryExpression(expr);
            const ast = parse(`(${baseExpr})`, { sourceType: 'module' });
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
            const message = ErrorHelpers.getErrorMessage(e);
            throw new Error(`Failed to parse expression "${expr}": ${message}`);
        }
    }

    public static replaceThisExpression(expr: string, replacement: string): string
    {
        try
        {
            const ast = parse(expr, { sourceType: 'module' });

            traverse(ast, {
                ThisExpression(path)
                {
                    path.replaceWith(t.identifier(replacement));
                }
            });

            let { code } = generate(ast, { compact: false });
            if (code.endsWith(';')) code = code.slice(0, -1);
            return code;
        }
        catch(e)
        {
            const message = ErrorHelpers.getErrorMessage(e);
            throw new Error(`Failed to parse expression "${expr}": ${message}`);
        }
    }
}
