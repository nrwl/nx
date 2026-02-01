import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { ComponentCompiler } from './ComponentCompiler.js';
import type { CompileResult } from './interfaces/CompileResult.js';

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

describe('ComponentCompiler', () =>
{
    it('should inject marker config when compiled component includes markers', async() =>
    {
        const tempDir = mkdtempSync(path.join(tmpdir(), 'fluff-cc-'));
        try
        {
            const componentPath = path.join(tempDir, 'test.component.ts');
            const templatePath = path.join(tempDir, 'test.component.html');
            const componentSource = `import { Component } from '@fluffjs/fluff';

@Component({
    selector: 'test-comp',
    templateUrl: './test.component.html'
})
export class TestComponent extends HTMLElement
{
}
`;
            const templateSource = '@if (show) { <span>ok</span> }';

            writeFileSync(componentPath, componentSource);
            writeFileSync(templatePath, templateSource);

            class TestCompiler extends ComponentCompiler
            {
                public override async stripTypeScriptWithSourceMap(code: string): Promise<CompileResult>
                {
                    await Promise.resolve();
                    return { code };
                }
            }

            const compiler = new TestCompiler();
            const result = await compiler.compileComponentForBundle(componentPath, false, false, true);

            expect(result.code)
                .toContain('__setMarkerConfigs(');
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
