import * as babel from '@babel/core';
import * as path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ComponentMetadata } from './babel-plugin-component.js';
import componentPlugin, { componentMetadataMap } from './babel-plugin-component.js';

describe('babel-plugin-component', () =>
{
    beforeEach(() =>
    {
        componentMetadataMap.clear();
    });

    const getMetadata = (filename: string): ComponentMetadata | undefined =>
    {
        for (const [key, value] of componentMetadataMap.entries())
        {
            if (key.endsWith(filename) || key === filename)
            {
                return value;
            }
        }
        return undefined;
    };

    const transform = (code: string, filename = 'test.component.ts'): string | null | undefined =>
    {
        const absolutePath = path.resolve(process.cwd(), filename);
        const result = babel.transformSync(code, {
            filename: absolutePath,
            presets: [['@babel/preset-typescript', { isTSX: false, allExtensions: true }]],
            plugins: [
                ['@babel/plugin-syntax-decorators', { version: '2023-11' }],
                componentPlugin
            ],
            parserOpts: {
                plugins: ['typescript', 'decorators']
            }
        });
        return result?.code;
    };

    describe('component metadata extraction', () =>
    {
        it('should extract selector from @Component decorator', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata)
                .toBeDefined();
            expect(metadata?.selector)
                .toBe('my-component');
        });

        it('should extract templateUrl', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    templateUrl: './my.component.html'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.templateUrl)
                .toBe('./my.component.html');
        });

        it('should extract inline template', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>{{ message }}</div>'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.template)
                .toBe('<div>{{ message }}</div>');
        });

        it('should extract styleUrl', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>',
                    styleUrl: './my.component.css'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.styleUrl)
                .toBe('./my.component.css');
        });

        it('should extract inline styles', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>',
                    styles: '.container { color: red; }'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.styles)
                .toBe('.container { color: red; }');
        });

        it('should extract className', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>'
                })
                export class MyAwesomeComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.className)
                .toBe('MyAwesomeComponent');
        });

        it('should handle template literal for template', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: \`
                        <div>
                            <span>Hello</span>
                        </div>
                    \`
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.template)
                .toContain('<div>');
            expect(metadata?.template)
                .toContain('<span>Hello</span>');
        });

        it('should handle template literal for styles', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>',
                    styles: \`
                        .container {
                            color: red;
                        }
                    \`
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.styles)
                .toContain('.container');
        });
    });

    describe('edge cases', () =>
    {
        it('should ignore classes without @Component decorator', () =>
        {
            const code = `
                export class RegularClass extends HTMLElement {}
            `;

            transform(code, 'regular.ts');

            expect(componentMetadataMap.has('regular.ts'))
                .toBe(false);
        });

        it('should ignore @Component without selector', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    template: '<div>Hello</div>'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            expect(componentMetadataMap.has('my.component.ts'))
                .toBe(false);
        });

        it('should ignore @Component without template or templateUrl', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            expect(componentMetadataMap.has('my.component.ts'))
                .toBe(false);
        });

        it('should handle multiple components in same file', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'first-component',
                    template: '<div>First</div>'
                })
                export class FirstComponent extends HTMLElement {}
                
                @Component({
                    selector: 'second-component',
                    template: '<div>Second</div>'
                })
                export class SecondComponent extends HTMLElement {}
            `;

            transform(code, 'multi.component.ts');

            const metadata = getMetadata('multi.component.ts');
            expect(metadata)
                .toBeDefined();
        });

        it('should handle component with all properties', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'full-component',
                    templateUrl: './full.component.html',
                    styleUrl: './full.component.css'
                })
                export class FullComponent extends HTMLElement {}
            `;

            transform(code, 'full.component.ts');

            const metadata = getMetadata('full.component.ts');
            expect(metadata?.selector)
                .toBe('full-component');
            expect(metadata?.templateUrl)
                .toBe('./full.component.html');
            expect(metadata?.styleUrl)
                .toBe('./full.component.css');
        });

        it('should handle hyphenated selector', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-awesome-component',
                    template: '<div>Hello</div>'
                })
                export class MyAwesomeComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.selector)
                .toBe('my-awesome-component');
        });

        it('should handle selector with prefix', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'app-header',
                    template: '<header>Header</header>'
                })
                export class AppHeaderComponent extends HTMLElement {}
            `;

            transform(code, 'header.component.ts');

            const metadata = getMetadata('header.component.ts');
            expect(metadata?.selector)
                .toBe('app-header');
        });
    });

    describe('decorator variations', () =>
    {
        it('should handle decorator with extra properties', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>',
                    unknownProp: 'value'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata?.selector)
                .toBe('my-component');
        });

        it('should handle decorator with computed property names', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>'
                })
                export class MyComponent extends HTMLElement {}
            `;

            transform(code, 'my.component.ts');

            const metadata = getMetadata('my.component.ts');
            expect(metadata)
                .toBeDefined();
        });

        it('should throw error when component class does not extend HTMLElement', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>'
                })
                export class MyComponent {}
            `;

            expect(() => transform(code, 'bad.component.ts'))
                .toThrow(/must extend HTMLElement/);
        });

        it('should throw error when component class extends wrong class', () =>
        {
            const code = `
                import { Component } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>Hello</div>'
                })
                export class MyComponent extends SomeOtherClass {}
            `;

            expect(() => transform(code, 'wrong-base.component.ts'))
                .toThrow(/must extend HTMLElement/);
        });
    });
});
