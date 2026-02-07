import { describe, it, expect } from 'vitest';
import { DecoratorValidator } from './DecoratorValidator.js';

describe('DecoratorValidator', () =>
{
    describe('validate', () =>
    {
        it('should pass when no decorators are present', () =>
        {
            const code = `
                class MyComponent extends FluffElement {
                    private value: string = '';
                    
                    public getValue(): string {
                        return this.value;
                    }
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).not.toThrow();
        });

        it('should throw when a class decorator remains', () =>
        {
            const code = `
                @Component({ selector: 'my-comp' })
                class MyComponent extends FluffElement {
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).toThrow(
                /Decorators must be stripped.*1 decorator\(s\) remain.*@Component on class 'MyComponent'/s
            );
        });

        it('should throw when a property decorator remains', () =>
        {
            const code = `
                class MyComponent extends FluffElement {
                    @Reactive()
                    private value: string = '';
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).toThrow(
                /Decorators must be stripped.*1 decorator\(s\) remain.*@Reactive on property 'MyComponent.value'/s
            );
        });

        it('should throw when a method decorator remains', () =>
        {
            const code = `
                class MyComponent extends FluffElement {
                    @HostListener('click')
                    public onClick(): void {
                    }
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).toThrow(
                /Decorators must be stripped.*1 decorator\(s\) remain.*@HostListener on method 'MyComponent.onClick'/s
            );
        });

        it('should throw when multiple decorators remain', () =>
        {
            const code = `
                @Component({ selector: 'my-comp' })
                class MyComponent extends FluffElement {
                    @Reactive()
                    private value: string = '';
                    
                    @Watch('value')
                    public onValueChange(): void {
                    }
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).toThrow(
                /Decorators must be stripped.*3 decorator\(s\) remain/s
            );
        });

        it('should detect decorators on exported classes', () =>
        {
            const code = `
                export @Component({ selector: 'my-comp' })
                class MyComponent extends FluffElement {
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).toThrow(
                /Decorators must be stripped.*@Component/s
            );
        });

        it('should detect decorators on default exported classes', () =>
        {
            const code = `
                @Component({ selector: 'my-comp' })
                export default class MyComponent extends FluffElement {
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).toThrow(
                /Decorators must be stripped.*@Component/s
            );
        });

        it('should detect decorators without parentheses', () =>
        {
            const code = `
                class MyComponent extends FluffElement {
                    @SomeDecorator
                    private value: string = '';
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, 'test.ts'); 
}).toThrow(
                /Decorators must be stripped.*@SomeDecorator/s
            );
        });

        it('should include file path in error message', () =>
        {
            const code = `
                @Component({ selector: 'my-comp' })
                class MyComponent extends FluffElement {
                }
            `;

            expect(() => 
{
 DecoratorValidator.validate(code, '/path/to/my.component.ts'); 
}).toThrow(
                /\/path\/to\/my\.component\.ts/
            );
        });
    });
});
