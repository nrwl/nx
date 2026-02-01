import type { PluginObj } from '@babel/core';
import { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';
import { filterDecoratorsFromNode } from './BabelHelpers.js';
import type { BabelPluginImportsState } from './interfaces/BabelPluginImportsState.js';

export type { ImportTransformOptions } from './interfaces/ImportTransformOptions.js';

export default function importsPlugin(): PluginObj<BabelPluginImportsState>
{
    // noinspection JSUnusedGlobalSymbols
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
                filterDecoratorsFromNode(path.node, removeDecorators);
            },

            ClassProperty(path: NodePath<t.ClassProperty>, state): void
            {
                const { removeDecorators } = state.opts ?? {};
                if (!removeDecorators?.length) return;
                filterDecoratorsFromNode(path.node, removeDecorators);
            },

            ClassMethod(path: NodePath<t.ClassMethod>, state): void
            {
                const { removeDecorators } = state.opts ?? {};
                if (!removeDecorators?.length) return;
                filterDecoratorsFromNode(path.node, removeDecorators);
            }
        }
    };
}
