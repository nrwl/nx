import type { PluginObj } from '@babel/core';
import { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';

export interface ClassTransformOptions
{
    className: string;
    originalSuperClass?: string;
    newSuperClass?: string;
    injectMethods?: {
        name: string; body: string;
    }[];
}

interface PluginState
{
    opts: ClassTransformOptions;
}

export default function classTransformPlugin(): PluginObj<PluginState>
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
                        const methodNode = t.classMethod('method', t.identifier(method.name), [], t.blockStatement([
                            t.expressionStatement(t.identifier(`__INJECT_${method.name}__`))
                        ]));
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

export function injectMethodBodies(code: string, methods: { name: string; body: string }[]): string
{
    let result = code;
    for (const method of methods)
    {
        const placeholder = `__INJECT_${method.name}__;`;
        result = result.replace(placeholder, method.body);
    }
    return result;
}
