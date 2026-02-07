import { parse } from '@babel/parser';
import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { traverse } from '../BabelHelpers.js';

interface MarkerConfigLiteralRecord
{
    [key: string]: MarkerConfigLiteral;
}

interface MarkerConfigLiteralArray extends Array<MarkerConfigLiteral>
{
    readonly __markerConfigArrayBrand?: true;
}

type MarkerConfigLiteral = string | number | boolean | null | MarkerConfigLiteralArray | MarkerConfigLiteralRecord;

type MarkerConfigEntriesLiteral = [number, MarkerConfigLiteral][];

type MarkerConfigRecord = MarkerConfigLiteralRecord;

type MarkerConfigRecordWithType = MarkerConfigRecord & { type?: MarkerConfigLiteral };

type MarkerConfigRecordWithDeps = MarkerConfigRecord & { deps?: MarkerConfigLiteral };

type MarkerConfigRecordWithBranches = MarkerConfigRecord & { branches?: MarkerConfigLiteral };

export class MarkerConfigAstReader
{
    public static readMarkerConfigEntries(code: string): MarkerConfigEntriesLiteral
    {
        const ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'decorators']
        });
        let markerConfigArg: t.Expression | null = null;

        traverse(ast, {
            CallExpression(path: NodePath<t.CallExpression>): void
            {
                if (MarkerConfigAstReader.isMarkerConfigCall(path.node))
                {
                    const [firstArg] = path.node.arguments;
                    if (firstArg && t.isExpression(firstArg))
                    {
                        markerConfigArg = firstArg;
                        path.stop();
                    }
                }
            }
        });

        if (!markerConfigArg)
        {
            throw new Error('Could not find __setMarkerConfigs call');
        }

        const literal = MarkerConfigAstReader.evaluateLiteral(markerConfigArg);
        if (!MarkerConfigAstReader.isEntriesArray(literal))
        {
            throw new Error('Expected marker config entries array');
        }
        return literal;
    }

    public static collectDeps(entries: MarkerConfigEntriesLiteral): string[]
    {
        const deps: string[] = [];
        for (const [, config] of entries)
        {
            if (!MarkerConfigAstReader.isRecord(config))
            {
                continue;
            }
            const configRecord: MarkerConfigRecordWithType = config;
            const typeValue = configRecord.type;
            if (typeof typeValue !== 'string')
            {
                continue;
            }
            switch (typeValue)
            {
                case 'text':
                    MarkerConfigAstReader.collectDepsFromRecord(configRecord, deps);
                    break;
                case 'if':
                    MarkerConfigAstReader.collectDepsFromIf(configRecord, deps);
                    break;
                case 'for':
                    MarkerConfigAstReader.collectDepsFromRecord(configRecord, deps);
                    break;
                case 'switch':
                    MarkerConfigAstReader.collectDepsFromRecord(configRecord, deps);
                    break;
            }
        }
        return deps;
    }

    private static collectDepsFromRecord(configRecord: MarkerConfigRecordWithDeps, deps: string[]): void
    {
        const configDeps = configRecord.deps;
        if (Array.isArray(configDeps))
        {
            for (const dep of configDeps)
            {
                MarkerConfigAstReader.collectStringsFromDep(dep, deps);
            }
        }
    }

    private static collectDepsFromIf(configRecord: MarkerConfigRecordWithBranches, deps: string[]): void
    {
        const { branches } = configRecord;
        if (!Array.isArray(branches))
        {
            return;
        }
        for (const branch of branches)
        {
            if (!MarkerConfigAstReader.isRecord(branch))
            {
                continue;
            }
            MarkerConfigAstReader.collectDepsFromRecord(branch, deps);
        }
    }

    private static collectStringsFromDep(dep: MarkerConfigLiteral, deps: string[]): void
    {
        if (typeof dep === 'string')
        {
            deps.push(dep);
            return;
        }
        if (Array.isArray(dep))
        {
            for (const item of dep)
            {
                MarkerConfigAstReader.collectStringsFromDep(item, deps);
            }
        }
    }

    private static isMarkerConfigCall(node: t.CallExpression): boolean
    {
        if (!t.isMemberExpression(node.callee))
        {
            return false;
        }
        if (!t.isIdentifier(node.callee.property))
        {
            return false;
        }
        return node.callee.property.name === '__setMarkerConfigs';
    }

    private static evaluateLiteral(node: t.Expression): MarkerConfigLiteral
    {
        if (t.isStringLiteral(node))
        {
            return node.value;
        }
        if (t.isNumericLiteral(node))
        {
            return node.value;
        }
        if (t.isBooleanLiteral(node))
        {
            return node.value;
        }
        if (t.isNullLiteral(node))
        {
            return null;
        }
        if (t.isArrayExpression(node))
        {
            const items: MarkerConfigLiteral[] = [];
            for (const element of node.elements)
            {
                if (!element || !t.isExpression(element))
                {
                    throw new Error('Unexpected array element in marker config literal');
                }
                items.push(MarkerConfigAstReader.evaluateLiteral(element));
            }
            return items;
        }
        if (t.isObjectExpression(node))
        {
            const result: Record<string, MarkerConfigLiteral> = {};
            for (const prop of node.properties)
            {
                if (!t.isObjectProperty(prop))
                {
                    throw new Error('Unexpected object property in marker config literal');
                }
                const key = MarkerConfigAstReader.readObjectKey(prop.key);
                if (!t.isExpression(prop.value))
                {
                    throw new Error('Unexpected object property value in marker config literal');
                }
                result[key] = MarkerConfigAstReader.evaluateLiteral(prop.value);
            }
            return result;
        }
        throw new Error('Unsupported marker config literal');
    }

    private static readObjectKey(key: t.Expression | t.PrivateName): string
    {
        if (t.isIdentifier(key))
        {
            return key.name;
        }
        if (t.isStringLiteral(key))
        {
            return key.value;
        }
        throw new Error('Unsupported object key in marker config literal');
    }

    private static isEntriesArray(value: MarkerConfigLiteral): value is MarkerConfigEntriesLiteral
    {
        if (!Array.isArray(value))
        {
            return false;
        }
        return value.every(entry =>
        {
            if (!Array.isArray(entry) || entry.length !== 2)
            {
                return false;
            }
            const [id, config] = entry;
            return typeof id === 'number' && MarkerConfigAstReader.isRecord(config);
        });
    }

    private static isRecord(value: MarkerConfigLiteral): value is MarkerConfigRecord
    {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
