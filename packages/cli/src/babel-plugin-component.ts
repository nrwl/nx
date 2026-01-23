import type { PluginObj } from '@babel/core';
import { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';

export interface ComponentMetadata
{
    selector: string;
    templateUrl: string;
    styleUrl?: string;
    className: string;
}

export const componentMetadataMap = new Map<string, ComponentMetadata>();

interface PluginState
{
    filename?: string;
}

export default function componentPlugin(): PluginObj<PluginState>
{
    return {
        name: 'babel-plugin-component', visitor: {
            ClassDeclaration(path: NodePath<t.ClassDeclaration>, state): void
            {
                const decorators = path.node.decorators ?? [];

                const componentDecorator = decorators.find(dec =>
                {
                    if (t.isCallExpression(dec.expression))
                    {
                        const { callee } = dec.expression;
                        return t.isIdentifier(callee) && callee.name === 'Component';
                    }
                    return false;
                });

                if (!componentDecorator) return;
                if (!t.isCallExpression(componentDecorator.expression)) return;

                const args = componentDecorator.expression.arguments;
                if (args.length === 0) return;

                const [configArg] = args;
                if (!t.isObjectExpression(configArg)) return;

                const metadata: Partial<ComponentMetadata> = {};

                if (path.node.id)
                {
                    metadata.className = path.node.id.name;
                }

                for (const prop of configArg.properties)
                {
                    if (!t.isObjectProperty(prop)) continue;
                    if (!t.isIdentifier(prop.key)) continue;

                    const key = prop.key.name;
                    const { value } = prop;

                    if (t.isStringLiteral(value))
                    {
                        switch (key)
                        {
                            case 'selector':
                                metadata.selector = value.value;
                                break;
                            case 'templateUrl':
                                metadata.templateUrl = value.value;
                                break;
                            case 'styleUrl':
                                metadata.styleUrl = value.value;
                                break;
                        }
                    }
                    else if (t.isTemplateLiteral(value) && value.quasis.length === 1)
                    {
                        const strValue = value.quasis[0].value.cooked ?? value.quasis[0].value.raw;
                        switch (key)
                        {
                            case 'selector':
                                metadata.selector = strValue;
                                break;
                            case 'templateUrl':
                                metadata.templateUrl = strValue;
                                break;
                            case 'styleUrl':
                                metadata.styleUrl = strValue;
                                break;
                        }
                    }
                }

                const filename = state.filename ?? 'unknown';
                if (metadata.selector && metadata.templateUrl && metadata.className)
                {
                    componentMetadataMap.set(filename, {
                        selector: metadata.selector,
                        templateUrl: metadata.templateUrl,
                        className: metadata.className,
                        styleUrl: metadata.styleUrl
                    });
                }
            }
        }
    };
}
