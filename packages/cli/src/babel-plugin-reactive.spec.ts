import * as babel from '@babel/core';
import * as path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import reactivePlugin, { reactivePropertiesMap } from './babel-plugin-reactive.js';

describe('babel-plugin-reactive', () =>
{
    beforeEach(() =>
    {
        reactivePropertiesMap.clear();
    });

    const getReactiveProps = (filename: string): Set<string> | undefined =>
    {
        for (const [key, value] of reactivePropertiesMap.entries())
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
                reactivePlugin
            ],
            parserOpts: {
                plugins: ['typescript', 'decorators']
            }
        });
        return result?.code;
    };

    describe('@Reactive decorator', () =>
    {
        it('should transform @Reactive property to Property wrapper', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>{{ count }}</div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count = 0;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('Property');
            expect(result)
                .toContain('propertyName: "count"');
            expect(getReactiveProps('my.component.ts'))
                .toContain('count');
        });

        it('should handle multiple @Reactive properties', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>{{ name }} {{ count }}</div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() name = 'World';
                    @Reactive() count = 0;
                }
            `;

            transform(code, 'my.component.ts');

            const props = getReactiveProps('my.component.ts');
            expect(props)
                .toContain('name');
            expect(props)
                .toContain('count');
        });

        it('should handle @Reactive with different initial values', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() stringProp = 'hello';
                    @Reactive() numberProp = 42;
                    @Reactive() boolProp = true;
                    @Reactive() arrayProp = [1, 2, 3];
                    @Reactive() objectProp = { key: 'value' };
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
            const props = getReactiveProps('my.component.ts');
            expect(props?.size)
                .toBe(5);
        });

        it('should handle @Reactive with null initial value', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() data = null;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should handle @Reactive with undefined initial value', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() data = undefined;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });
    });

    describe('@Input decorator', () =>
    {
        it('should transform @Input property', () =>
        {
            const code = `
                import { Component, Input } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>{{ data }}</div>'
                })
                export class MyComponent extends HTMLElement {
                    @Input() data = '';
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
            expect(getReactiveProps('my.component.ts'))
                .toContain('data');
        });

        it('should handle @Input with complex type', () =>
        {
            const code = `
                import { Component, Input } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Input() items: string[] = [];
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });
    });

    describe('@LinkedProperty decorator', () =>
    {
        it('should call linked method when Property instance is set', () =>
        {
            const code = `
                import { Component, Reactive, LinkedProperty, Property } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() myProp = null;
                    
                    @LinkedProperty('myProp')
                    onLinkedProperty(prop) {
                        console.log('linked');
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result).toBeDefined();
            expect(result).toContain('instanceof Property');
            expect(result).toContain('this.onLinkedProperty(__v)');
        });

        it('should not add instanceof check when no @LinkedProperty for that prop', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() myProp = null;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result).toBeDefined();
            expect(result).not.toContain('instanceof Property');
        });
    });

    describe('@Watch decorator', () =>
    {
        it('should handle @Watch decorator on method', () =>
        {
            const code = `
                import { Component, Reactive, Watch } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count = 0;
                    
                    @Watch('count')
                    onCountChange() {
                        console.log('count changed');
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should handle @Watch with multiple properties', () =>
        {
            const code = `
                import { Component, Reactive, Watch } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() firstName = '';
                    @Reactive() lastName = '';
                    
                    @Watch('firstName', 'lastName')
                    onNameChange() {
                        console.log('name changed');
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should pass property name to @Watch callback', () =>
        {
            const code = `
                import { Component, Reactive, Watch } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count = 0;
                    
                    @Watch('count')
                    onCountChange(changed: string) {
                        console.log(changed);
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('this.onCountChange("count")');
        });

        it('should pass correct property name for each watched property', () =>
        {
            const code = `
                import { Component, Reactive, Watch } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() firstName = '';
                    @Reactive() lastName = '';
                    
                    @Watch('firstName', 'lastName')
                    onNameChange(changed: string) {
                        console.log(changed);
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('this.onNameChange("firstName")');
            expect(result)
                .toContain('this.onNameChange("lastName")');
        });

        it('should push @Watch subscriptions to __baseSubscriptions for cleanup on destroy', () =>
        {
            const code = `
                import { Component, Reactive, Watch } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count = 0;
                    
                    @Watch('count')
                    onCountChange(changed: string) {
                        console.log(changed);
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('__baseSubscriptions.push');
        });
    });

    describe('@Pipe decorator', () =>
    {
        it('should handle @Pipe decorator on method', () =>
        {
            const code = `
                import { Component, Pipe } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>{{ name | uppercase }}</div>'
                })
                export class MyComponent extends HTMLElement {
                    @Pipe('uppercase')
                    uppercase(value: string): string {
                        return value.toUpperCase();
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should handle @Pipe with arguments', () =>
        {
            const code = `
                import { Component, Pipe } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div>{{ text | truncate:50 }}</div>'
                })
                export class MyComponent extends HTMLElement {
                    @Pipe('truncate')
                    truncate(value: string, length: number): string {
                        return value.slice(0, length);
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });
    });

    describe('@HostListener decorator', () =>
    {
        it('should handle @HostListener decorator', () =>
        {
            const code = `
                import { Component, HostListener } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @HostListener('click')
                    onClick() {
                        console.log('clicked');
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should handle @HostListener with keyboard event', () =>
        {
            const code = `
                import { Component, HostListener } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @HostListener('keydown')
                    onKeyDown(event: KeyboardEvent) {
                        console.log(event.key);
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });
    });

    describe('@HostBinding decorator', () =>
    {
        it('should handle @HostBinding on property', () =>
        {
            const code = `
                import { Component, HostBinding } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @HostBinding('class.active')
                    isActive = false;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should handle @HostBinding on getter', () =>
        {
            const code = `
                import { Component, HostBinding, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count = 0;
                    
                    @HostBinding('class.has-items')
                    get hasItems() {
                        return this.count > 0;
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should handle @HostBinding with attr prefix', () =>
        {
            const code = `
                import { Component, HostBinding } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @HostBinding('attr.role')
                    role = 'button';
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should handle @HostBinding with style prefix', () =>
        {
            const code = `
                import { Component, HostBinding } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @HostBinding('style.backgroundColor')
                    bgColor = 'red';
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });
    });

    describe('edge cases', () =>
    {
        it('should handle class without decorators', () =>
        {
            const code = `
                export class PlainClass {
                    value = 0;
                }
            `;

            const result = transform(code, 'plain.ts');

            expect(result)
                .toBeDefined();
            expect(reactivePropertiesMap.has('plain.ts'))
                .toBe(false);
        });

        it('should handle mixed decorated and non-decorated properties', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() reactiveValue = 0;
                    normalValue = 'static';
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
            const props = getReactiveProps('my.component.ts');
            expect(props)
                .toContain('reactiveValue');
            expect(props)
                .not
                .toContain('normalValue');
        });

        it('should handle property with type annotation', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count: number = 0;
                    @Reactive() name: string = '';
                    @Reactive() items: string[] = [];
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should add Property import if not present', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count = 0;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('Property');
        });

        it('should not duplicate Property import if already present', () =>
        {
            const code = `
                import { Component, Reactive, Property } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() count = 0;
                }
            `;

            const result = transform(code, 'my.component.ts');

            const importMatches = result?.match(/import.*Property/g);
            expect(importMatches?.length)
                .toBeLessThanOrEqual(2);
        });
    });

    describe('$watch method', () =>
    {
        it('should handle $watch call for computed properties', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() firstName = '';
                    @Reactive() lastName = '';
                    
                    fullName = this.$watch(['firstName', 'lastName'], () => {
                        return this.firstName + ' ' + this.lastName;
                    });
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });

        it('should pass property name to $watch callback', () =>
        {
            const code = `
                import { Component, Reactive } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @Reactive() firstName = '';
                    @Reactive() lastName = '';
                    
                    sub = this.$watch(['firstName', 'lastName'], (changed) => {
                        console.log(changed);
                    });
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('__cb("firstName")');
            expect(result)
                .toContain('__cb("lastName")');
        });
    });

    describe('multiple decorators on same element', () =>
    {
        it('should handle multiple decorators on same method', () =>
        {
            const code = `
                import { Component, Watch, HostListener } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<div></div>'
                })
                export class MyComponent extends HTMLElement {
                    @HostListener('click')
                    onClick() {
                        console.log('clicked');
                    }
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toBeDefined();
        });
    });

    describe('@ViewChild decorator (template refs)', () =>
    {
        it('should transform @ViewChild to getter that queries by data-ref attribute', () =>
        {
            const code = `
                import { Component, ViewChild } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<input #myInput type="text" />'
                })
                export class MyComponent extends HTMLElement {
                    @ViewChild('myInput') myInputEl;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('get myInputEl()');
            expect(result)
                .toContain('querySelector');
            expect(result)
                .toContain('data-ref=');
            expect(result)
                .toContain('myInput');
        });

        it('should handle multiple @ViewChild decorators', () =>
        {
            const code = `
                import { Component, ViewChild } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<input #firstName /><input #lastName />'
                })
                export class MyComponent extends HTMLElement {
                    @ViewChild('firstName') firstNameInput;
                    @ViewChild('lastName') lastNameInput;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('get firstNameInput()');
            expect(result)
                .toContain('get lastNameInput()');
            expect(result)
                .toContain('firstName');
            expect(result)
                .toContain('lastName');
        });

        it('should remove the original @ViewChild property declaration', () =>
        {
            const code = `
                import { Component, ViewChild } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<button #submitBtn>Submit</button>'
                })
                export class MyComponent extends HTMLElement {
                    @ViewChild('submitBtn') submitButton;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .not
                .toContain('@ViewChild');
            expect(result)
                .toContain('get submitButton()');
        });

        it('should generate getter that falls back to direct selector query', () =>
        {
            const code = `
                import { Component, ViewChild } from '@fluffjs/fluff';
                
                @Component({
                    selector: 'my-component',
                    template: '<input #myInput />'
                })
                export class MyComponent extends HTMLElement {
                    @ViewChild('myInput') inputRef;
                }
            `;

            const result = transform(code, 'my.component.ts');

            expect(result)
                .toContain('||');
            expect(result)
                .toContain('myInput');
        });
    });
});
