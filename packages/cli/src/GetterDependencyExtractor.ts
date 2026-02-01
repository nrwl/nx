import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { traverse } from './BabelHelpers.js';

export class GetterDependencyExtractor
{
    public static extractGetterDependencyMap(code: string, reactiveProps: Set<string>): Map<string, string[]>
    {
        const getterDeps = new Map<string, string[]>();

        const backingFieldToProp = new Map<string, string>();
        for (const prop of reactiveProps)
        {
            backingFieldToProp.set(`__${prop}`, prop);
        }

        const ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'decorators']
        });

        const getterNames = new Set<string>();
        traverse(ast, {
            ClassMethod(path)
            {
                const { node } = path;
                if (node.kind !== 'get')
                {
                    return;
                }
                if (t.isIdentifier(node.key))
                {
                    getterNames.add(node.key.name);
                }
            }
        });

        traverse(ast, {
            ClassMethod(path)
            {
                const { node } = path;
                if (node.kind !== 'get')
                {
                    return;
                }
                if (!t.isIdentifier(node.key))
                {
                    return;
                }

                const getterName = node.key.name;
                const deps = new Set<string>();

                path.traverse({
                    MemberExpression(memberPath)
                    {
                        const { node: memberNode } = memberPath;

                        const { object, property, computed } = memberNode;

                        if (!t.isThisExpression(object))
                        {
                            return;
                        }
                        if (computed)
                        {
                            return;
                        }
                        if (!t.isIdentifier(property))
                        {
                            return;
                        }

                        const propName = property.name;

                        const publicPropName = backingFieldToProp.get(propName) ?? propName;

                        const { parent } = memberPath;
                        if (t.isCallExpression(parent) && parent.callee === memberNode)
                        {
                            return;
                        }

                        if (reactiveProps.has(publicPropName))
                        {
                            deps.add(publicPropName);
                            return;
                        }

                        if (getterNames.has(publicPropName))
                        {
                            return;
                        }
                    }
                });

                if (deps.size > 0)
                {
                    getterDeps.set(getterName, Array.from(deps));
                }
            }
        });

        return getterDeps;
    }
}
