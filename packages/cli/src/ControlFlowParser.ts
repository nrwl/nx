import { parse } from '@babel/parser';
import * as t from '@babel/types';

export interface IfBlock
{
    type: 'if';
    condition: string;
    ifContent: string;
    elseContent: string;
    start: number;
    end: number;
}

export interface ForBlock
{
    type: 'for';
    iterator: string;
    iterable: string;
    trackBy?: string;
    content: string;
    start: number;
    end: number;
}

export interface SwitchCase
{
    value: string | null;  // null for @default
    content: string;
    fallthrough: boolean;
}

export interface SwitchBlock
{
    type: 'switch';
    expression: string;
    cases: SwitchCase[];
    start: number;
    end: number;
}

export type ControlFlowBlock = IfBlock | ForBlock | SwitchBlock;

const OPENING_BRACE_PATTERN = /^\s*\{/;
const OPENING_BRACE_WITH_PAREN_PATTERN = /^\)?\s*\{/;
const FALLTHROUGH_PATTERN = /@fallthrough\s*$/;

export class ControlFlowParser
{
    public parseAll(input: string): {
        result: string; blocks: ControlFlowBlock[]
    }
    {
        let result = input;
        const allBlocks: ControlFlowBlock[] = [];

        const switchResult = this.parseSwitchBlocks(result);
        ({ result } = switchResult);
        allBlocks.push(...switchResult.blocks);

        const forResult = this.parseForBlocks(result);
        ({ result } = forResult);
        allBlocks.push(...forResult.blocks);

        const ifResult = this.parseIfBlocks(result);
        ({ result } = ifResult);
        allBlocks.push(...ifResult.blocks);

        return { result, blocks: allBlocks };
    }

    private findMatchingDelimiter(str: string, openIdx: number, openChar: string, closeChar: string): number
    {
        let depth = 1;
        let inString: false | '"' | '\'' | '`' = false;
        let i = openIdx + 1;

        while (i < str.length && depth > 0)
        {
            const char = str[i];
            const prevChar = str[i - 1];

            if (prevChar === '\\' && inString)
            {
                i++;
                continue;
            }

            if (!inString)
            {
                if (char === '"' || char === '\'' || char === '`')
                {
                    inString = char;
                }
                else if (char === openChar)
                {
                    depth++;
                }
                else if (char === closeChar)
                {
                    depth--;
                }
            }
            else
            {
                if (char === inString)
                {
                    inString = false;
                }
                else if (inString === '`' && char === '$' && str[i + 1] === '{')
                {
                    i += 2;
                    let templateDepth = 1;
                    while (i < str.length && templateDepth > 0)
                    {
                        const tc = str[i];
                        if (tc === '{') templateDepth++; else if (tc === '}') templateDepth--; else if (tc === '`')
                        {
                            i++;
                            while (i < str.length && str[i] !== '`')
                            {
                                if (str[i] === '\\') i++;
                                i++;
                            }
                        }
                        i++;
                    }
                    continue;
                }
            }
            i++;
        }

        return depth === 0 ? i - 1 : -1;
    }

    private findMatchingBrace(str: string, openIdx: number): number
    {
        return this.findMatchingDelimiter(str, openIdx, '{', '}');
    }

    private extractParenContent(str: string, startIdx: number): { content: string; endIdx: number } | null
    {
        if (str[startIdx] !== '(') return null;
        const endIdx = this.findMatchingDelimiter(str, startIdx, '(', ')');
        if (endIdx === -1) return null;
        return {
            content: str.slice(startIdx + 1, endIdx), endIdx
        };
    }

    private parseForExpression(expr: string): { iterator: string; iterable: string; trackBy?: string } | null
    {
        let mainExpr = expr;
        let trackBy: string | undefined = undefined;

        const trackIndex = expr.indexOf('; track ');
        if (trackIndex !== -1)
        {
            mainExpr = expr.slice(0, trackIndex);
            trackBy = expr.slice(trackIndex + 8)
                .trim();
        }

        try
        {
            const wrappedCode = `for (const ${mainExpr}) {}`;
            const ast = parse(wrappedCode, { sourceType: 'module' });
            const [stmt] = ast.program.body;

            if (!t.isForOfStatement(stmt)) return null;

            const { left } = stmt;
            let iterator = '';
            if (t.isVariableDeclaration(left) && left.declarations.length === 1)
            {
                const [decl] = left.declarations;
                if (t.isIdentifier(decl.id))
                {
                    iterator = decl.id.name;
                }
                else
                {
                    iterator = mainExpr.slice(0, mainExpr.indexOf(' of '))
                        .trim();
                }
            }
            else
            {
                return null;
            }

            const ofIndex = mainExpr.indexOf(' of ');
            if (ofIndex === -1) return null;
            const iterable = mainExpr.slice(ofIndex + 4)
                .trim();

            return { iterator, iterable, trackBy };
        }
        catch
        {
            const ofIndex = mainExpr.indexOf(' of ');
            if (ofIndex === -1) return null;

            const fallbackIterator = mainExpr.slice(0, ofIndex)
                .trim();
            const iterable = mainExpr.slice(ofIndex + 4)
                .trim();

            return { iterator: fallbackIterator, iterable, trackBy };
        }
    }

    private parseBlockStructure(input: string, match: RegExpExecArray): {
        expr: string;
        content: string;
        braceEnd: number
    } | null
    {
        const parenStart = match.index + match[0].length - 1;

        const exprResult = this.extractParenContent(input, parenStart);
        if (!exprResult) return null;

        const afterExpr = input.slice(exprResult.endIdx + 1);
        const braceMatch = OPENING_BRACE_PATTERN.exec(afterExpr);
        if (!braceMatch) return null;

        const braceStart = exprResult.endIdx + 1 + braceMatch[0].length - 1;
        const braceEnd = this.findMatchingBrace(input, braceStart);
        if (braceEnd === -1) return null;

        return {
            expr: exprResult.content.trim(),
            content: input.slice(braceStart + 1, braceEnd)
                .trim(),
            braceEnd
        };
    }

    public parseSwitchBlocks(input: string): { result: string; blocks: SwitchBlock[] }
    {
        const blocks: SwitchBlock[] = [];
        let result = input;
        const switchRegex = /@switch\s*\(/g;
        let match: RegExpExecArray | null = null;

        while ((match = switchRegex.exec(result)) !== null)
        {
            const startIdx = match.index;
            const parsed = this.parseBlockStructure(result, match);
            if (!parsed) continue;

            const cases = this.parseSwitchCases(parsed.content);

            blocks.push({
                type: 'switch', expression: parsed.expr, cases, start: startIdx, end: parsed.braceEnd
            });

            const placeholder = `__SWITCH_BLOCK_${blocks.length - 1}`;
            result = result.slice(0, startIdx) + placeholder + result.slice(parsed.braceEnd + 1);
            switchRegex.lastIndex = startIdx + placeholder.length;
        }

        return { result, blocks };
    }

    private parseSwitchCases(switchBody: string): SwitchCase[]
    {
        const cases: SwitchCase[] = [];
        const caseRegex = /@(case|default)\s*\(?/g;
        let match: RegExpExecArray | null = null;

        while ((match = caseRegex.exec(switchBody)) !== null)
        {
            const [, caseType] = match;
            let value: string | null = null;
            let contentStart = 0;

            if (caseType === 'case')
            {
                const parenIdx = switchBody.indexOf('(', match.index);
                if (parenIdx === -1) continue;

                const valueResult = this.extractParenContent(switchBody, parenIdx);
                if (!valueResult) continue;

                value = valueResult.content.trim();

                const afterValue = switchBody.slice(valueResult.endIdx + 1);
                const braceMatch = OPENING_BRACE_PATTERN.exec(afterValue);
                if (!braceMatch) continue;

                contentStart = valueResult.endIdx + 1 + braceMatch[0].length;
            }
            else
            {
                const afterDefault = switchBody.slice(match.index + match[0].length);
                const braceMatch = OPENING_BRACE_WITH_PAREN_PATTERN.exec(afterDefault);
                if (!braceMatch) continue;

                contentStart = match.index + match[0].length + braceMatch[0].length;
            }

            const contentEnd = this.findMatchingBrace(switchBody, contentStart - 1);
            if (contentEnd === -1) continue;

            let content = switchBody.slice(contentStart, contentEnd);

            const fallthrough = FALLTHROUGH_PATTERN.test(content.trim());
            if (fallthrough)
            {
                content = content.replace(FALLTHROUGH_PATTERN, '')
                    .trim();
            }

            cases.push({
                value, content: content.trim(), fallthrough
            });

            caseRegex.lastIndex = contentEnd + 1;
        }

        return cases;
    }

    public parseForBlocks(input: string): { result: string; blocks: ForBlock[] }
    {
        const blocks: ForBlock[] = [];
        let result = input;
        const forRegex = /@for\s*\(/g;
        let match: RegExpExecArray | null = null;

        while ((match = forRegex.exec(result)) !== null)
        {
            const startIdx = match.index;
            const parsed = this.parseBlockStructure(result, match);
            if (!parsed) continue;

            const forParts = this.parseForExpression(parsed.expr);
            if (!forParts) continue;

            const { iterator, iterable, trackBy } = forParts;

            blocks.push({
                type: 'for', iterator, iterable, trackBy, content: parsed.content, start: startIdx, end: parsed.braceEnd
            });

            const placeholder = `__FOR_BLOCK_${blocks.length - 1}__`;
            result = result.slice(0, startIdx) + placeholder + result.slice(parsed.braceEnd + 1);
            forRegex.lastIndex = startIdx + placeholder.length;
        }

        return { result, blocks };
    }

    public parseIfBlocks(input: string): { result: string; blocks: IfBlock[] }
    {
        const blocks: IfBlock[] = [];
        let result = input;
        const ifRegex = /@if\s*\(/g;
        let match: RegExpExecArray | null = null;

        while ((match = ifRegex.exec(result)) !== null)
        {
            const startIdx = match.index;
            const parsed = this.parseBlockStructure(result, match);
            if (!parsed) continue;

            let elseContent = '';
            let totalEnd = parsed.braceEnd;

            const afterIf = result.slice(parsed.braceEnd + 1);
            const elseMatch = /^\s*@else\s*\{/.exec(afterIf);
            if (elseMatch)
            {
                const elseBraceStart = parsed.braceEnd + 1 + elseMatch[0].length - 1;
                const elseBraceEnd = this.findMatchingBrace(result, elseBraceStart);
                if (elseBraceEnd !== -1)
                {
                    elseContent = result.slice(elseBraceStart + 1, elseBraceEnd)
                        .trim();
                    totalEnd = elseBraceEnd;
                }
            }

            blocks.push({
                type: 'if',
                condition: parsed.expr,
                ifContent: parsed.content,
                elseContent,
                start: startIdx,
                end: totalEnd
            });

            const placeholder = `__IF_BLOCK_${blocks.length - 1}__`;
            result = result.slice(0, startIdx) + placeholder + result.slice(totalEnd + 1);
            ifRegex.lastIndex = startIdx + placeholder.length;
        }

        return { result, blocks };
    }
}
