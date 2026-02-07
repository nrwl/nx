import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { reactivePropertiesMap } from './babel-plugin-reactive.js';
import { ComponentCompiler } from './ComponentCompiler.js';
import type { CompileResult } from './interfaces/CompileResult.js';
import { MarkerConfigAstReader } from './testing/MarkerConfigAstReader.js';

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

class TestCompiler extends ComponentCompiler
{
    public override async stripTypeScriptWithSourceMap(code: string): Promise<CompileResult>
    {
        await Promise.resolve();
        return { code };
    }
}

describe('ComponentCompiler (getter deps)', () =>
{
    it('should expand getter deps when getter is accessed via property chain like parsedTags.length', async() =>
    {
        const tempDir = mkdtempSync(path.join(tmpdir(), 'fluff-cc-getter-chain-'));
        try
        {
            const componentPath = path.join(tempDir, 'test.component.ts');
            const templatePath = path.join(tempDir, 'test.component.html');

            const componentSource = `import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'test-comp',
    templateUrl: './test.component.html'
})
export class TestComponent extends HTMLElement
{
    @Reactive
    public tagsInput: string = '';

    public get parsedTags(): string[]
    {
        return this.tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }
}
`;

            const templateSource = '@if (parsedTags.length > 0) { <span>has tags</span> }';

            writeFileSync(componentPath, componentSource);
            writeFileSync(templatePath, templateSource);

            const compiler = new TestCompiler();
            const result = await compiler.compileComponentForBundle(componentPath, false, false, true);

            const entries = MarkerConfigAstReader.readMarkerConfigEntries(result.code);
            const deps = MarkerConfigAstReader.collectDeps(entries);
            expect(deps)
                .toContain('tagsInput');
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should expand getter deps to the reactive properties referenced in the getter body', async() =>
    {
        const tempDir = mkdtempSync(path.join(tmpdir(), 'fluff-cc-getter-deps-'));
        try
        {
            const componentPath = path.join(tempDir, 'test.component.ts');
            const templatePath = path.join(tempDir, 'test.component.html');

            const componentSource = `import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'test-comp',
    templateUrl: './test.component.html'
})
export class TestComponent extends HTMLElement
{
    @Reactive
    public items: string[] = [];

    public get itemCount(): number
    {
        return this.items.length;
    }
}
`;

            const templateSource = '<span>{{ itemCount }}</span>';

            writeFileSync(componentPath, componentSource);
            writeFileSync(templatePath, templateSource);

            const compiler = new TestCompiler();
            const result = await compiler.compileComponentForBundle(componentPath, false, false, true);

            let reactivePropsForFile: Set<string> | undefined = undefined;
            for (const [key, value] of reactivePropertiesMap.entries())
            {
                if (key === componentPath || key.endsWith(componentPath) || componentPath.endsWith(key))
                {
                    reactivePropsForFile = value;
                    break;
                }
            }
            expect(reactivePropsForFile)
                .toBeDefined();
            expect(Array.from(reactivePropsForFile ?? []))
                .toContain('items');

            const entries = MarkerConfigAstReader.readMarkerConfigEntries(result.code);
            const deps = MarkerConfigAstReader.collectDeps(entries);
            expect(deps)
                .toContain('items');
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
