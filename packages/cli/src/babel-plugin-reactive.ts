import type { PluginObj } from '@babel/core';
import { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';
import { buildHostBindingUpdateStatement, findDecoratorIndex, getDecoratorName } from './BabelHelpers.js';
import type { BabelPluginReactiveState } from './interfaces/BabelPluginReactiveState.js';
import type { BabelPluginReactiveWatchCallInfo } from './interfaces/BabelPluginReactiveWatchCallInfo.js';
import type { BabelPluginReactiveWatchInfo } from './interfaces/BabelPluginReactiveWatchInfo.js';

export const reactivePropertiesMap = new Map<string, Set<string>>();

export default function reactivePlugin(): PluginObj<BabelPluginReactiveState>
{
    // noinspection JSUnusedGlobalSymbols
    return {
        name: 'babel-plugin-reactive', visitor: {
            Program: {
                enter(path, state): void
                {
                    state.needsPropertyImport = false;
                    state.reactiveProperties = new Set();
                    state.watchMethods = [];
                }, exit(path, state): void
                {
                    const filename = state.filename ?? 'unknown';
                    if (state.reactiveProperties && state.reactiveProperties.size > 0)
                    {
                        reactivePropertiesMap.set(filename, state.reactiveProperties);
                    }
                    if (state.needsPropertyImport)
                    {
                        const hasPropertyImport = path.node.body.some(node =>
                        {
                            if (t.isImportDeclaration(node))
                            {
                                return node.specifiers.some(spec => t.isImportSpecifier(spec) && t.isIdentifier(spec.imported) && spec.imported.name === 'Property');
                            }
                            return false;
                        });

                        if (!hasPropertyImport)
                        {
                            const importDecl = t.importDeclaration([t.importSpecifier(t.identifier('Property'), t.identifier('Property'))], t.stringLiteral('@fluffjs/fluff'));
                            path.node.body.unshift(importDecl);
                        }
                    }
                }
            },

            ClassBody(path, state): void
            {
                const watchCalls: BabelPluginReactiveWatchCallInfo[] = [];
                const watchCallProps: NodePath<t.ClassProperty>[] = [];

                for (const memberPath of path.get('body'))
                {
                    if (!memberPath.isClassProperty()) continue;
                    const init = memberPath.node.value;
                    if (!init || !t.isCallExpression(init)) continue;

                    const { callee } = init;
                    if (!t.isMemberExpression(callee)) continue;
                    if (!t.isThisExpression(callee.object)) continue;
                    if (!t.isIdentifier(callee.property) || callee.property.name !== '$watch') continue;

                    const propName = t.isIdentifier(memberPath.node.key) ? memberPath.node.key.name : null;
                    if (!propName) continue;

                    const args = init.arguments;
                    if (args.length < 2) continue;

                    const [propsArg, callbackArg] = args;

                    if (!t.isArrayExpression(propsArg)) continue;

                    const watchedProps = propsArg.elements
                        .filter((el): el is t.StringLiteral => t.isStringLiteral(el))
                        .map(el => el.value);

                    watchCalls.push({ propName, watchedProps, callbackArg });
                    watchCallProps.push(memberPath);
                }

                for (const p of watchCallProps)
                {
                    p.remove();
                }
                const newMembers: t.ClassMethod[] = [];
                const propsToRemove: NodePath<t.ClassProperty>[] = [];
                const watchMethods: BabelPluginReactiveWatchInfo[] = [];
                const privateFields: t.ClassProperty[] = [];
                const getterHostBindingUpdates: string[] = [];
                const propertyHostBindingInits: { propName: string; privateName: string }[] = [];

                const pipeMethods: { pipeName: string; methodName: string }[] = [];
                const hostListeners: { methodName: string; eventName: string }[] = [];

                for (const memberPath of path.get('body'))
                {
                    if (memberPath.isClassMethod())
                    {
                        const methodNode = memberPath.node;
                        const decorators = methodNode.decorators ?? [];

                        const hostListenerIndex = findDecoratorIndex(decorators, 'HostListener');

                        if (hostListenerIndex >= 0)
                        {
                            const hostListenerDecorator = decorators[hostListenerIndex];
                            if (t.isCallExpression(hostListenerDecorator.expression))
                            {
                                const args = hostListenerDecorator.expression.arguments;
                                if (args.length > 0 && t.isStringLiteral(args[0]))
                                {
                                    const eventName = args[0].value;
                                    if (t.isIdentifier(methodNode.key))
                                    {
                                        hostListeners.push({
                                            methodName: methodNode.key.name, eventName
                                        });
                                    }
                                }
                            }
                            decorators.splice(hostListenerIndex, 1);
                        }

                        const pipeDecoratorIndex = findDecoratorIndex(decorators, 'Pipe');

                        if (pipeDecoratorIndex >= 0)
                        {
                            const pipeDecorator = decorators[pipeDecoratorIndex];
                            if (t.isCallExpression(pipeDecorator.expression))
                            {
                                const args = pipeDecorator.expression.arguments;
                                if (args.length > 0 && t.isStringLiteral(args[0]))
                                {
                                    const pipeName = args[0].value;
                                    if (t.isIdentifier(methodNode.key))
                                    {
                                        pipeMethods.push({
                                            pipeName, methodName: methodNode.key.name
                                        });
                                    }
                                }
                            }
                            decorators.splice(pipeDecoratorIndex, 1);
                        }

                        const watchDecoratorIndex = findDecoratorIndex(decorators, 'Watch');

                        if (watchDecoratorIndex >= 0)
                        {
                            const watchDecorator = decorators[watchDecoratorIndex];
                            if (t.isCallExpression(watchDecorator.expression))
                            {
                                const args = watchDecorator.expression.arguments;
                                const watchedProps = args
                                    .filter((arg): arg is t.StringLiteral => t.isStringLiteral(arg))
                                    .map(arg => arg.value);

                                if (t.isIdentifier(methodNode.key) && watchedProps.length > 0)
                                {
                                    watchMethods.push({
                                        methodName: methodNode.key.name, watchedProps
                                    });
                                }
                            }
                            decorators.splice(watchDecoratorIndex, 1);
                        }

                        if (methodNode.kind === 'get')
                        {
                            const hostBindingIndex = findDecoratorIndex(decorators, 'HostBinding');

                            if (hostBindingIndex >= 0)
                            {
                                const hostBindingDecorator = decorators[hostBindingIndex];
                                if (t.isCallExpression(hostBindingDecorator.expression))
                                {
                                    const args = hostBindingDecorator.expression.arguments;
                                    if (args.length > 0 && t.isStringLiteral(args[0]) && t.isIdentifier(methodNode.key))
                                    {
                                        const hostProperty = args[0].value;
                                        const getterName = methodNode.key.name;

                                        const updateStatement = buildHostBindingUpdateStatement(hostProperty);

                                        const updateMethod = t.classMethod('method', t.identifier(`__updateHostBinding_${getterName}`), [], t.blockStatement([
                                            t.variableDeclaration('const', [t.variableDeclarator(t.identifier('__v'), t.memberExpression(t.thisExpression(), t.identifier(getterName)))]),
                                            updateStatement
                                        ]));

                                        newMembers.push(updateMethod);
                                        getterHostBindingUpdates.push(`__updateHostBinding_${getterName}`);
                                    }
                                }
                                decorators.splice(hostBindingIndex, 1);
                            }
                        }
                        continue;
                    }

                    if (!memberPath.isClassProperty()) continue;

                    const propNode = memberPath.node;
                    const decorators = propNode.decorators ?? [];

                    const hostBindingDecoratorIndex = findDecoratorIndex(decorators, 'HostBinding');

                    if (hostBindingDecoratorIndex >= 0)
                    {
                        const hostBindingDecorator = decorators[hostBindingDecoratorIndex];
                        if (t.isCallExpression(hostBindingDecorator.expression))
                        {
                            const args = hostBindingDecorator.expression.arguments;
                            if (args.length > 0 && t.isStringLiteral(args[0]) && t.isIdentifier(propNode.key))
                            {
                                const hostProperty = args[0].value;
                                const propName = propNode.key.name;
                                const privateName = `__hostBinding_${propName}`;
                                const initialValue = propNode.value ?? t.identifier('undefined');

                                const privateField = t.classProperty(t.identifier(privateName), initialValue);

                                const getter = t.classMethod('get', t.identifier(propName), [], t.blockStatement([
                                    t.returnStatement(t.memberExpression(t.thisExpression(), t.identifier(privateName)))
                                ]));

                                const updateStatement = buildHostBindingUpdateStatement(hostProperty);

                                const setter = t.classMethod('set', t.identifier(propName), [t.identifier('__v')], t.blockStatement([
                                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.thisExpression(), t.identifier(privateName)), t.identifier('__v'))),
                                    updateStatement
                                ]));

                                newMembers.push(getter, setter);
                                propsToRemove.push(memberPath);
                                propertyHostBindingInits.push({ propName, privateName });

                                path.unshiftContainer('body', privateField);
                            }
                        }
                        continue;
                    }

                    const viewChildDecoratorIndex = findDecoratorIndex(decorators, 'ViewChild');

                    if (viewChildDecoratorIndex >= 0)
                    {
                        const viewChildDecorator = decorators[viewChildDecoratorIndex];
                        if (t.isCallExpression(viewChildDecorator.expression))
                        {
                            const args = viewChildDecorator.expression.arguments;
                            if (args.length > 0 && t.isStringLiteral(args[0]) && t.isIdentifier(propNode.key))
                            {
                                const selector = args[0].value;
                                const propName = propNode.key.name;

                                const getter = t.classMethod('get', t.identifier(propName), [], t.blockStatement([
                                    t.returnStatement(t.logicalExpression('||', t.callExpression(t.memberExpression(t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('__getShadowRoot')), []), t.identifier('querySelector')), [t.stringLiteral(`[data-ref="${selector}"]`)]), t.callExpression(t.memberExpression(t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('__getShadowRoot')), []), t.identifier('querySelector')), [t.stringLiteral(selector)])))
                                ]));

                                newMembers.push(getter);
                                propsToRemove.push(memberPath);
                            }
                        }
                        continue;
                    }

                    const reactiveDecoratorIndices: number[] = [];
                    for (const [idx, dec] of decorators.entries())
                    {
                        const name = getDecoratorName(dec);
                        if (name === 'Reactive' || name === 'Input')
                        {
                            reactiveDecoratorIndices.push(idx);
                        }
                    }

                    if (reactiveDecoratorIndices.length === 0) continue;

                    for (let i = reactiveDecoratorIndices.length - 1; i >= 0; i--)
                    {
                        decorators.splice(reactiveDecoratorIndices[i], 1);
                    }
                    if (!t.isIdentifier(propNode.key)) continue;

                    const propName = propNode.key.name;
                    const privateName = `__${propName}`;
                    const initialValue = propNode.value ?? t.identifier('undefined');

                    state.needsPropertyImport = true;
                    state.reactiveProperties?.add(propName);

                    const isProduction = state.opts?.production ?? false;
                    const propertyArgs = isProduction
                        ? [initialValue]
                        : [
                            t.objectExpression([
                                t.objectProperty(t.identifier('initialValue'), initialValue),
                                t.objectProperty(t.identifier('propertyName'), t.stringLiteral(propName))
                            ])
                        ];
                    const privateField = t.classProperty(t.identifier(privateName), t.newExpression(t.identifier('Property'), propertyArgs));

                    const getter = t.classMethod('get', t.identifier(propName), [], t.blockStatement([
                        t.returnStatement(t.callExpression(t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier(privateName)), t.identifier('getValue')), []))
                    ]));

                    const setter = t.classMethod('set', t.identifier(propName), [t.identifier('__v')], t.blockStatement([
                        t.expressionStatement(t.callExpression(t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier(privateName)), t.identifier('setValue')), [t.identifier('__v')]))
                    ]));

                    propsToRemove.push(memberPath);
                    newMembers.push(getter, setter);
                    privateFields.push(privateField);
                }

                for (const p of propsToRemove)
                {
                    p.remove();
                }
                for (const field of privateFields.reverse())
                {
                    path.unshiftContainer('body', field);
                }
                for (const member of newMembers.reverse())
                {
                    path.unshiftContainer('body', member);
                }

                if (pipeMethods.length > 0)
                {
                    const pipeProperties = pipeMethods.map(({
                                                                pipeName,
                                                                methodName
                                                            }) => t.objectProperty(t.identifier(pipeName), t.arrowFunctionExpression([t.restElement(t.identifier('args'))], t.callExpression(t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier(methodName)), t.identifier('apply')), [
                        t.thisExpression(),
                        t.identifier('args')
                    ]))));

                    const pipesProperty = t.classProperty(t.identifier('__pipes'), t.objectExpression(pipeProperties));

                    path.unshiftContainer('body', pipesProperty);
                }

                const classDecl = path.parentPath;
                const classNode = classDecl?.node;
                const decorators = (classNode && 'decorators' in classNode ? classNode.decorators : null) ?? [];
                const componentDecorator = decorators.find((dec: t.Decorator) => t.isCallExpression(dec.expression) && t.isIdentifier(dec.expression.callee) && dec.expression.callee.name === 'Component');

                if (componentDecorator && t.isCallExpression(componentDecorator.expression))
                {
                    const args = componentDecorator.expression.arguments;
                    if (args.length > 0 && t.isObjectExpression(args[0]))
                    {
                        const [configObj] = args;
                        const pipesProp = configObj.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'pipes');

                        if (pipesProp && t.isObjectProperty(pipesProp) && t.isArrayExpression(pipesProp.value))
                        {
                            const pipeClasses = pipesProp.value.elements.filter((el): el is t.Identifier => t.isIdentifier(el));

                            if (pipeClasses.length > 0)
                            {
                                const simplePipeProperties = pipeClasses.map(pipeClass => t.objectProperty(t.memberExpression(pipeClass, t.identifier('__pipeName')), t.arrowFunctionExpression([
                                    t.identifier('v'),
                                    t.restElement(t.identifier('a'))
                                ], t.callExpression(t.memberExpression(t.newExpression(pipeClass, []), t.identifier('transform')), [
                                    t.identifier('v'),
                                    t.spreadElement(t.identifier('a'))
                                ])), true));

                                const pipesFromClasses = t.classProperty(t.identifier('__pipes'), t.objectExpression(simplePipeProperties));

                                path.unshiftContainer('body', pipesFromClasses);
                            }
                        }
                    }
                }

                const reactiveProps = state.reactiveProperties ?? new Set<string>();
                const constructorStatements: t.Statement[] = [];

                for (const updateMethodName of getterHostBindingUpdates)
                {
                    constructorStatements.push(t.expressionStatement(t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(updateMethodName)), [])));
                }

                for (const { propName, privateName } of propertyHostBindingInits)
                {
                    constructorStatements.push(t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.thisExpression(), t.identifier(propName)), t.memberExpression(t.thisExpression(), t.identifier(privateName)))));
                }

                for (const { methodName, watchedProps: mProps } of watchMethods)
                {
                    constructorStatements.push(t.expressionStatement(t.unaryExpression('void', t.memberExpression(t.thisExpression(), t.identifier(methodName)))));
                    for (const prop of mProps)
                    {
                        if (reactiveProps.has(prop))
                        {
                            constructorStatements.push(t.expressionStatement(t.callExpression(t.memberExpression(t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier(`__${prop}`)), t.identifier('onChange')), t.identifier('subscribe')), [t.arrowFunctionExpression([], t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(methodName)), []))])));
                        }
                    }
                }

                for (const { propName, watchedProps: wProps, callbackArg } of watchCalls)
                {
                    const iife: t.Statement[] = [
                        t.variableDeclaration('const', [t.variableDeclarator(t.identifier('__cb'), t.isExpression(callbackArg) ? callbackArg : t.identifier('undefined'))]),
                        t.variableDeclaration('const', [t.variableDeclarator(t.identifier('__subs'), t.arrayExpression([]))])
                    ];
                    for (const prop of wProps)
                    {
                        if (reactiveProps.has(prop))
                        {
                            iife.push(t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('__subs'), t.identifier('push')), [
                                t.callExpression(t.memberExpression(t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier(`__${prop}`)), t.identifier('onChange')), t.identifier('subscribe')), [t.identifier('__cb')])
                            ])));
                        }
                    }
                    iife.push(t.expressionStatement(t.callExpression(t.identifier('__cb'), [])));
                    iife.push(t.returnStatement(t.objectExpression([
                        t.objectMethod('method', t.identifier('unsubscribe'), [], t.blockStatement([
                            t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('__subs'), t.identifier('forEach')), [
                                t.arrowFunctionExpression([t.identifier('s')], t.callExpression(t.memberExpression(t.identifier('s'), t.identifier('unsubscribe')), []))
                            ]))
                        ]))
                    ])));
                    const watchClassProp = t.classProperty(
                        t.identifier(propName),
                        t.callExpression(t.arrowFunctionExpression([], t.blockStatement(iife)), [])
                    );
                    path.pushContainer('body', watchClassProp);
                }

                for (const { methodName, eventName } of hostListeners)
                {
                    const [baseEvent, ...modifiers] = eventName.split('.');

                    let handlerBody: t.Statement = t.emptyStatement();
                    if (modifiers.length > 0)
                    {
                        const conditions = modifiers.map(mod =>
                        {
                            if (mod === 'enter') return t.binaryExpression('===', t.memberExpression(t.identifier('__ev'), t.identifier('key')), t.stringLiteral('Enter'));
                            if (mod === 'escape') return t.binaryExpression('===', t.memberExpression(t.identifier('__ev'), t.identifier('key')), t.stringLiteral('Escape'));
                            if (mod === 'space') return t.binaryExpression('===', t.memberExpression(t.identifier('__ev'), t.identifier('key')), t.stringLiteral(' '));
                            return t.booleanLiteral(true);
                        });
                        const combinedCondition: t.Expression = conditions.reduce<t.Expression>((acc, cond) => t.logicalExpression('&&', acc, cond), t.booleanLiteral(true));
                        handlerBody = t.ifStatement(combinedCondition, t.expressionStatement(t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(methodName)), [t.identifier('__ev')])));
                    }
                    else
                    {
                        handlerBody = t.expressionStatement(t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(methodName)), [t.identifier('__ev')]));
                    }

                    constructorStatements.push(t.expressionStatement(t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('addEventListener')), [
                        t.stringLiteral(baseEvent),
                        t.arrowFunctionExpression([t.identifier('__ev')], t.blockStatement([handlerBody]))
                    ])));
                }

                if (constructorStatements.length > 0)
                {
                    const constructor = path.node.body.find((m): m is t.ClassMethod => t.isClassMethod(m) && m.kind === 'constructor');
                    if (constructor)
                    {
                        const superIndex = constructor.body.body.findIndex(stmt => t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression) && t.isSuper(stmt.expression.callee));
                        constructor.body.body.splice(superIndex >= 0 ? superIndex + 1 : 0, 0, ...constructorStatements);
                    }
                    else
                    {
                        path.unshiftContainer('body', t.classMethod('constructor', t.identifier('constructor'), [], t.blockStatement([
                            t.expressionStatement(t.callExpression(t.super(), [])), ...constructorStatements
                        ])));
                    }
                }
            }
        }
    };
}
