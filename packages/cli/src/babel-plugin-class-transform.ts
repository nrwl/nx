import type { PluginObj } from '@babel/core';
import { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';
import { parseMethodBody } from './BabelHelpers.js';
import type { BabelPluginClassTransformState } from './interfaces/BabelPluginClassTransformState.js';

export type { ClassTransformOptions } from './interfaces/ClassTransformOptions.js';

export default function classTransformPlugin(): PluginObj<BabelPluginClassTransformState>
{
    return {
        name: 'babel-plugin-class-transform', visitor: {
            ClassDeclaration(path: NodePath<t.ClassDeclaration>, state): void
            {
                const opts = state.opts || {};
                const { className, originalSuperClass, newSuperClass, injectMethods } = opts;

                if (!path.node.id?.name || path.node.id.name !== className)
                {
                    return;
                }

                if (originalSuperClass && newSuperClass && path.node.superClass)
                {
                    if (t.isIdentifier(path.node.superClass) && path.node.superClass.name === originalSuperClass)
                    {
                        path.node.superClass = t.identifier(newSuperClass);
                    }
                }

                if (injectMethods && injectMethods.length > 0)
                {
                    const newMethods: t.ClassMethod[] = [];

                    for (const method of injectMethods)
                    {
                        const bodyStatements = parseMethodBody(method.body);
                        const methodNode = t.classMethod('method', t.identifier(method.name), [], t.blockStatement(bodyStatements));
                        newMethods.push(methodNode);
                    }

                    for (const method of newMethods.reverse())
                    {
                        path.get('body')
                            .unshiftContainer('body', method);
                    }
                }
            }
        }
    };
}
