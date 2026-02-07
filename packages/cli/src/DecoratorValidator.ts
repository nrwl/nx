import { parse } from '@babel/parser';
import * as t from '@babel/types';

interface DecoratorLocation
{
    name: string;
    line: number;
    column: number;
    target: 'class' | 'method' | 'property';
    targetName: string;
}

export class DecoratorValidator
{
    public static validate(code: string, filePath: string): void
    {
        const decorators = DecoratorValidator.findDecorators(code);

        if (decorators.length > 0)
        {
            const details = decorators.map(d =>
                `  - @${d.name} on ${d.target} '${d.targetName}' at line ${d.line}, column ${d.column}`
            ).join('\n');

            throw new Error(
                `Decorators must be stripped before output but ${decorators.length} decorator(s) remain in ${filePath}:\n${details}`
            );
        }
    }

    private static findDecorators(code: string): DecoratorLocation[]
    {
        const results: DecoratorLocation[] = [];

        let ast: t.File | null = null;
        try
        {
            ast = parse(code, {
                sourceType: 'module',
                plugins: ['typescript', 'decorators']
            });
        }
        catch
        {
            return results;
        }

        if (!ast)
        {
            return results;
        }

        for (const node of ast.program.body)
        {
            DecoratorValidator.checkNode(node, results);
        }

        return results;
    }

    private static checkNode(node: t.Node, results: DecoratorLocation[]): void
    {
        if (t.isExportNamedDeclaration(node) && node.declaration)
        {
            DecoratorValidator.checkNode(node.declaration, results);
            return;
        }

        if (t.isExportDefaultDeclaration(node) && t.isClassDeclaration(node.declaration))
        {
            DecoratorValidator.checkClassDeclaration(node.declaration, results);
            return;
        }

        if (t.isClassDeclaration(node))
        {
            DecoratorValidator.checkClassDeclaration(node, results);
        }
    }

    private static checkClassDeclaration(node: t.ClassDeclaration, results: DecoratorLocation[]): void
    {
        const className = node.id?.name ?? '<anonymous>';

        if (node.decorators && node.decorators.length > 0)
        {
            for (const decorator of node.decorators)
            {
                results.push({
                    name: DecoratorValidator.getDecoratorName(decorator),
                    line: decorator.loc?.start.line ?? 0,
                    column: decorator.loc?.start.column ?? 0,
                    target: 'class',
                    targetName: className
                });
            }
        }

        for (const member of node.body.body)
        {
            DecoratorValidator.checkClassMember(member, className, results);
        }
    }

    private static checkClassMember(member: t.ClassBody['body'][number], className: string, results: DecoratorLocation[]): void
    {
        if (!('decorators' in member) || !member.decorators || member.decorators.length === 0)
        {
            return;
        }

        const memberName = DecoratorValidator.getMemberName(member);
        const target: 'method' | 'property' = t.isClassMethod(member) ? 'method' : 'property';

        for (const decorator of member.decorators)
        {
            results.push({
                name: DecoratorValidator.getDecoratorName(decorator),
                line: decorator.loc?.start.line ?? 0,
                column: decorator.loc?.start.column ?? 0,
                target,
                targetName: `${className}.${memberName}`
            });
        }
    }

    private static getMemberName(member: t.ClassBody['body'][number]): string
    {
        if ('key' in member && t.isIdentifier(member.key))
        {
            return member.key.name;
        }
        return '<unknown>';
    }

    private static getDecoratorName(decorator: t.Decorator): string
    {
        if (t.isCallExpression(decorator.expression))
        {
            if (t.isIdentifier(decorator.expression.callee))
            {
                return decorator.expression.callee.name;
            }
        }
        else if (t.isIdentifier(decorator.expression))
        {
            return decorator.expression.name;
        }
        return '<unknown>';
    }
}
