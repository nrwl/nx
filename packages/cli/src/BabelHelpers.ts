import _generate from '@babel/generator';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';

export const generate = _generate.default ?? _generate;
export const traverse = _traverse.default ?? _traverse;

export function findDecoratorIndex(decorators: t.Decorator[], name: string): number
{
    return decorators.findIndex(dec =>
    {
        if (t.isCallExpression(dec.expression) && t.isIdentifier(dec.expression.callee))
        {
            return dec.expression.callee.name === name;
        }
        return false;
    });
}

export function getDecoratorName(decorator: t.Decorator): string | null
{
    const expr = decorator.expression;

    if (t.isCallExpression(expr) && t.isIdentifier(expr.callee))
    {
        return expr.callee.name;
    }

    if (t.isIdentifier(expr))
    {
        return expr.name;
    }

    return null;
}

export interface DecoratedNode
{
    decorators?: t.Decorator[] | null;
}

export function filterDecoratorsFromNode(node: DecoratedNode, removeDecorators: string[]): void
{
    const { decorators } = node;
    if (!decorators) return;

    node.decorators = decorators.filter(dec =>
    {
        const name = getDecoratorName(dec);
        return !name || !removeDecorators.includes(name);
    });
}

export function parseMethodBody(body: string): t.Statement[]
{
    const wrappedCode = `class __Temp__ { __temp__() { ${body} } }`;
    const ast = parse(wrappedCode, { sourceType: 'module' });
    const [classDecl] = ast.program.body;
    if (t.isClassDeclaration(classDecl))
    {
        const [method] = classDecl.body.body;
        if (t.isClassMethod(method))
        {
            return method.body.body;
        }
    }
    return [];
}

export function buildHostBindingUpdateStatement(hostProperty: string): t.Statement
{
    if (hostProperty.startsWith('class.'))
    {
        const className = hostProperty.slice(6);
        return t.ifStatement(
            t.identifier('__v'),
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(
                        t.memberExpression(t.thisExpression(), t.identifier('classList')),
                        t.identifier('add')
                    ),
                    [t.stringLiteral(className)]
                )
            ),
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(
                        t.memberExpression(t.thisExpression(), t.identifier('classList')),
                        t.identifier('remove')
                    ),
                    [t.stringLiteral(className)]
                )
            )
        );
    }
    else if (hostProperty.startsWith('attr.'))
    {
        const attrName = hostProperty.slice(5);
        return t.ifStatement(
            t.binaryExpression('!=', t.identifier('__v'), t.nullLiteral()),
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.thisExpression(), t.identifier('setAttribute')),
                    [
                        t.stringLiteral(attrName),
                        t.callExpression(t.identifier('String'), [t.identifier('__v')])
                    ]
                )
            ),
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.thisExpression(), t.identifier('removeAttribute')),
                    [t.stringLiteral(attrName)]
                )
            )
        );
    }
    else if (hostProperty.startsWith('style.'))
    {
        const styleProp = hostProperty.slice(6);
        return t.expressionStatement(
            t.assignmentExpression(
                '=',
                t.memberExpression(
                    t.memberExpression(t.thisExpression(), t.identifier('style')),
                    t.identifier(styleProp)
                ),
                t.logicalExpression('||', t.identifier('__v'), t.stringLiteral(''))
            )
        );
    }
    else
    {
        return t.expressionStatement(
            t.assignmentExpression(
                '=',
                t.memberExpression(t.thisExpression(), t.identifier(hostProperty)),
                t.identifier('__v')
            )
        );
    }
}
