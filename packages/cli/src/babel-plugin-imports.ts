import type { PluginObj } from '@babel/core';
import { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';

export interface ImportTransformOptions
{
    removeImportsFrom?: string[];
    removeDecorators?: string[];
    pathReplacements?: Record<string, string>;
    addJsExtension?: boolean;
}

interface PluginState
{
    opts: ImportTransformOptions;
}

function getDecoratorName(decorator: t.Decorator): string | null
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

export default function importsPlugin(): PluginObj<PluginState>
{
    return {
        name: 'babel-plugin-imports', visitor: {
            ImportDeclaration(path: NodePath<t.ImportDeclaration>, state): void
            {
                const opts = state.opts ?? {};
                const source = path.node.source.value;

                if (opts.removeImportsFrom?.includes(source))
                {
                    path.remove();
                    return;
                }

                let newSource = source;
                if (opts.pathReplacements)
                {
                    for (const [from, to] of Object.entries(opts.pathReplacements))
                    {
                        if (newSource.startsWith(from))
                        {
                            newSource = to + newSource.slice(from.length);
                            break;
                        }
                    }
                }

                if (opts.addJsExtension && newSource.startsWith('.') && !newSource.endsWith('.js'))
                {
                    newSource = newSource + '.js';
                }

                if (newSource !== source)
                {
                    path.node.source = t.stringLiteral(newSource);
                }
            },

            ClassDeclaration(path: NodePath<t.ClassDeclaration>, state): void
            {
                const { removeDecorators } = state.opts ?? {};
                if (!removeDecorators?.length) return;

                const { decorators } = path.node;
                if (!decorators) return;

                path.node.decorators = decorators.filter(dec =>
                {
                    const name = getDecoratorName(dec);
                    return !name || !removeDecorators.includes(name);
                });
            },

            ClassProperty(path: NodePath<t.ClassProperty>, state): void
            {
                const { removeDecorators } = state.opts ?? {};
                if (!removeDecorators?.length) return;

                const { decorators } = path.node;
                if (!decorators) return;

                path.node.decorators = decorators.filter(dec =>
                {
                    const name = getDecoratorName(dec);
                    return !name || !removeDecorators.includes(name);
                });
            },

            ClassMethod(path: NodePath<t.ClassMethod>, state): void
            {
                const { removeDecorators } = state.opts ?? {};
                if (!removeDecorators?.length) return;

                const { decorators } = path.node;
                if (!decorators) return;

                path.node.decorators = decorators.filter(dec =>
                {
                    const name = getDecoratorName(dec);
                    return !name || !removeDecorators.includes(name);
                });
            }
        }
    };
}
