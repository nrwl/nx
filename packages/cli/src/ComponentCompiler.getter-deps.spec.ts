import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { reactivePropertiesMap } from './babel-plugin-reactive.js';
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

            const match = /__setMarkerConfigs\(("(?:\\.|[^"\\])*?")\);/s.exec(result.code);
            if (!match)
            {
                throw new Error('Could not find __setMarkerConfigs call');
            }

            const configJsonParsed: unknown = JSON.parse(match[1]);
            if (typeof configJsonParsed !== 'string')
            {
                throw new Error('Expected __setMarkerConfigs argument to be a JSON string');
            }
            const entriesParsed: unknown = JSON.parse(configJsonParsed);
            if (!Array.isArray(entriesParsed))
            {
                throw new Error('Expected marker config entries array');
            }

            const ifConfigs = entriesParsed.filter((entry): entry is [
                number, {
                    type: string;
                    branches?: { deps?: unknown }[]
                }
            ] =>
            {
                if (!Array.isArray(entry) || entry.length !== 2)
                {
                    return false;
                }
                const [, config] = entry;
                if (typeof config !== 'object' || config === null)
                {
                    return false;
                }
                if (!('type' in config))
                {
                    return false;
                }
                const recordType: unknown = Reflect.get(config, 'type');
                return recordType === 'if';
            });

            expect(ifConfigs.length)
                .toBe(1);

            const [[, ifConfig]] = ifConfigs;
            const { branches } = ifConfig;
            expect(Array.isArray(branches))
                .toBe(true);
            if (Array.isArray(branches) && branches.length > 0)
            {
                const [firstBranch] = branches;
                const { deps } = firstBranch;
                expect(Array.isArray(deps))
                    .toBe(true);
                if (Array.isArray(deps))
                {
                    expect(deps)
                        .toContain('tagsInput');
                }
            }
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

            const match = /__setMarkerConfigs\(("(?:\\.|[^"\\])*?")\);/s.exec(result.code);
            if (!match)
            {
                throw new Error('Could not find __setMarkerConfigs call');
            }

            const configJsonParsed: unknown = JSON.parse(match[1]);
            if (typeof configJsonParsed !== 'string')
            {
                throw new Error('Expected __setMarkerConfigs argument to be a JSON string');
            }
            const entriesParsed: unknown = JSON.parse(configJsonParsed);
            if (!Array.isArray(entriesParsed))
            {
                throw new Error('Expected marker config entries array');
            }
            const entries = entriesParsed;

            const textConfigs = entries.filter((entry): entry is [number, { type: string; deps?: unknown }] =>
            {
                if (!Array.isArray(entry) || entry.length !== 2)
                {
                    return false;
                }
                const [, config] = entry;
                if (typeof config !== 'object' || config === null)
                {
                    return false;
                }
                if (!('type' in config))
                {
                    return false;
                }
                const recordType: unknown = Reflect.get(config, 'type');
                return recordType === 'text';
            });

            expect(textConfigs.length)
                .toBe(1);

            const [firstTextConfig] = textConfigs;
            const [, textConfig] = firstTextConfig;
            const { deps } = textConfig;
            expect(Array.isArray(deps))
                .toBe(true);
            if (Array.isArray(deps))
            {
                expect(deps)
                    .toContain('items');
            }
        }
        finally
        {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
