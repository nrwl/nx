import { describe, expect, it } from 'vitest';
import { TemplateParser } from './TemplateParser.js';

function createDeferred(): { promise: Promise<void>; resolve: () => void }
{
    let resolve: (() => void) | null = null;
    const promise = new Promise<void>(r =>
    {
        resolve = r;
    });
    if (!resolve)
    {
        throw new Error('resolve not set');
    }
    return { promise, resolve };
}

describe('TemplateParser (race)', () =>
{
    it('should show that shared getterDependencyMap can be clobbered during parse', async() =>
    {
        const parser = new TemplateParser();

        const beforeLookup = createDeferred();
        let yielded = false;

        parser.__setTestYieldBeforeGetterDepsLookup(async() =>
        {
            if (yielded)
            {
                return;
            }
            yielded = true;
            await beforeLookup.promise;
        });

        parser.setGetterDependencyMap(new Map([
            ['completionPercent', ['stats']]
        ]));

        const parsePromise = parser.parse('<span>{{ completionPercent }}%</span>');

        await Promise.resolve();

        parser.setGetterDependencyMap(new Map([
            ['otherGetter', ['other']]
        ]));

        beforeLookup.resolve();

        const parsed = await parsePromise;

        const findInterpolation = (nodes: typeof parsed.root): { deps?: unknown } | null =>
        {
            for (const node of nodes)
            {
                if (node.type === 'interpolation')
                {
                    return node;
                }
                if (node.type === 'element')
                {
                    const found = findInterpolation(node.children);
                    if (found)
                    {
                        return found;
                    }
                }
                if (node.type === 'if')
                {
                    for (const branch of node.branches)
                    {
                        const found = findInterpolation(branch.children);
                        if (found)
                        {
                            return found;
                        }
                    }
                }
                if (node.type === 'for')
                {
                    const found = findInterpolation(node.children);
                    if (found)
                    {
                        return found;
                    }
                    if (node.emptyContent)
                    {
                        const emptyFound = findInterpolation(node.emptyContent);
                        if (emptyFound)
                        {
                            return emptyFound;
                        }
                    }
                }
                if (node.type === 'switch')
                {
                    for (const c of node.cases)
                    {
                        const found = findInterpolation(c.children);
                        if (found)
                        {
                            return found;
                        }
                    }
                }
            }
            return null;
        };

        const interp = findInterpolation(parsed.root);
        if (!interp)
        {
            throw new Error('Expected interpolation');
        }

        expect(interp.deps)
            .not
            .toContain('stats');
    });
});
