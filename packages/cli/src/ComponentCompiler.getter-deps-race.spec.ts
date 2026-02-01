import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { ComponentCompiler } from './ComponentCompiler.js';
import type { CompileResult } from './interfaces/CompileResult.js';
import { TemplateParser } from './TemplateParser.js';

vi.mock('esbuild', () =>
{
    return {
        transform: async(code: string): Promise<{ code: string }> =>
        {
            await Promise.resolve();
            return { code };
        },
        build: async(): Promise<{ metafile: { outputs: Record<string, unknown> } }> =>
        {
            await Promise.resolve();
            return { metafile: { outputs: {} } };
        }
    };
});

interface Deferred
{
    promise: Promise<void>;
    resolve: () => void;
}

function createDeferred(): Deferred
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

describe('ComponentCompiler (getter deps race)', () =>
{
    it('should not clobber getter dep expansion when compiling multiple components concurrently', async() =>
    {
        const tempDir = mkdtempSync(path.join(tmpdir(), 'fluff-cc-getter-race-'));
        try
        {
            const componentPathA = path.join(tempDir, 'a.component.ts');
            const templatePathA = path.join(tempDir, 'a.component.html');
            const componentPathB = path.join(tempDir, 'b.component.ts');
            const templatePathB = path.join(tempDir, 'b.component.html');

            const componentSourceA = `import { Component, Input } from '@fluffjs/fluff';

@Component({ selector: 'a-comp', templateUrl: './a.component.html' })
export class AComponent extends HTMLElement
{
    @Input() public stats: { total: number } = { total: 0 };

    public get completionPercent(): number
    {
        return this.stats.total;
    }
}
`;

            const componentSourceB = `import { Component, Input } from '@fluffjs/fluff';

@Component({ selector: 'b-comp', templateUrl: './b.component.html' })
export class BComponent extends HTMLElement
{
    @Input() public stats: { total: number } = { total: 0 };

    public get urgentAndHighCount(): number
    {
        return this.stats.total;
    }
}
`;

            writeFileSync(componentPathA, componentSourceA);
            writeFileSync(templatePathA, '<span>{{ completionPercent }}</span>');
            writeFileSync(componentPathB, componentSourceB);
            writeFileSync(templatePathB, '<span>{{ urgentAndHighCount }}</span>');

            const pauseA = createDeferred();

            class TestCompiler extends ComponentCompiler
            {
                public override async stripTypeScriptWithSourceMap(code: string): Promise<CompileResult>
                {
                    await Promise.resolve();
                    return { code };
                }

                protected override createTemplateParser(filePath: string): TemplateParser
                {
                    const parser = new TemplateParser();
                    if (filePath.endsWith('a.component.ts'))
                    {
                        parser.__setTestYieldBeforeGetterDepsLookup(async() =>
                        {
                            await pauseA.promise;
                        });
                    }
                    return parser;
                }
            }

            const compiler = new TestCompiler();

            const aPromise = compiler.compileComponentForBundle(componentPathA, false, false, true);

            await Promise.resolve();

            const bPromise = compiler.compileComponentForBundle(componentPathB, false, false, true);

            await Promise.resolve();
            pauseA.resolve();

            const [aResult] = await Promise.all([aPromise, bPromise]);

            const match = /__setMarkerConfigs\(("(?:\\.|[^"\\])*?")\);/s.exec(aResult.code);
            if (!match)
            {
                throw new Error('Could not find __setMarkerConfigs call');
            }

            const configJsonParsed: unknown = JSON.parse(match[1]);
            if (typeof configJsonParsed !== 'string')
            {
                throw new Error('Expected __setMarkerConfigs argument to be a JSON string');
            }

            expect(configJsonParsed)
                .toContain('"deps":["stats"]');
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
