import * as parse5 from 'parse5';
import { beforeEach, describe, expect, it } from 'vitest';
import { CodeGenerator } from './CodeGenerator.js';
import { TemplateParser } from './TemplateParser.js';

function extractHtml(renderMethod: string): string
{
    const match = /innerHTML = (".*?");/s.exec(renderMethod);
    if (!match) throw new Error('Could not extract HTML from render method');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-type-assertion
    return new Function('return ' + match[1])() as string;
}

describe('CodeGenerator', () =>
{
    beforeEach(() =>
    {
        CodeGenerator.resetGlobalState();
    });

    describe('multiple bindings on same element', () =>
    {
        it('should serialize all bindings into a single data-bindings attribute', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = `
                <my-component
                    [prop1]="value1"
                    [prop2]="value2"
                    (event1)="handler1()"
                    (event2)="handler2()"
                ></my-component>
            `;

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .not
                .toContain('data-bindings=');
            expect(html)
                .not
                .toMatch(/data-bind-prop="[^"]*".*data-bind-prop="/);
            expect(html)
                .not
                .toMatch(/data-bind-event="[^"]*".*data-bind-event="/);

            const bindingsMap = generator.getBindingsMap();
            const bindings = bindingsMap.l0;

            expect(Array.isArray(bindings))
                .toBe(true);
            expect(bindings)
                .toHaveLength(4);
            if (Array.isArray(bindings))
            {
                expect(bindings[0])
                    .toMatchObject({ n: 'prop1', b: 'property' });
                expect(bindings[1])
                    .toMatchObject({ n: 'prop2', b: 'property' });
                expect(bindings[2])
                    .toMatchObject({ n: 'event1', b: 'event' });
                expect(bindings[3])
                    .toMatchObject({ n: 'event2', b: 'event' });
            }
        });

        it('should not create data-bindings attribute for elements without bindings', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<div class="plain">text</div>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .not
                .toContain('data-bindings');
            expect(html)
                .not
                .toContain('data-lid');
        });

        it('should emit bindings in map and not in HTML', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<input [value]="searchQuery" />';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .not
                .toContain('data-bindings');
            const bindingsMap = generator.getBindingsMap();
            expect(bindingsMap)
                .toHaveProperty('l0');
        });

        it('should include marker config injection for templates with markers', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '@if (condition) { <span>ok</span> }';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);

            expect(renderMethod)
                .toContain('__setMarkerConfigs(');
        });
    });

    describe('generated html', () =>
    {
        it('should parse with parse5', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<div><span>{{ name }}</span></div>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            const fragment = parse5.parseFragment(html);
            expect(fragment)
                .toBeTruthy();
        });
    });

    describe('compiled expr tables', () =>
    {
        it('should use t.* for component property access', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<input [value]="searchQuery" />';

            const parsed = await parser.parse(template);
            generator.generateRenderMethod(parsed);

            const compiled = CodeGenerator.generateGlobalExprTable();

            expect(compiled)
                .toContain('t.searchQuery');
            expect(compiled)
                .toContain('(t, l) =>');
        });

        it('should use __ev for $event in event handlers', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<button (click)="handleClick($event.target.value)"></button>';

            const parsed = await parser.parse(template);
            generator.generateRenderMethod(parsed);

            const compiled = CodeGenerator.generateGlobalExprTable();

            expect(compiled)
                .toContain('t.handleClick(__ev.target.value)');
            expect(compiled)
                .toContain('(t, l, __ev) =>');
            expect(compiled)
                .not
                .toContain('(t,l,e)');
        });

        it('should emit FluffBase.__e global table', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<span>{{ name }}</span>';

            const parsed = await parser.parse(template);
            generator.generateRenderMethod(parsed);

            const compiled = CodeGenerator.generateGlobalExprTable();

            expect(compiled)
                .toContain('FluffBase.__e =');
            expect(compiled)
                .toContain('FluffBase.__h =');
        });

        it('should emit expression assignments for component', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<span>{{ name }}</span>';

            const parsed = await parser.parse(template);
            generator.generateRenderMethod(parsed);

            const assignments = generator.generateExpressionAssignments();

            expect(assignments)
                .toContain('FluffBase.__e[0] =');
            expect(assignments)
                .toContain('t.name');
        });

        it('should emit expressions from multiple components into single global table', async() =>
        {
            const parser = new TemplateParser();

            const gen1 = new CodeGenerator();
            const parsed1 = await parser.parse('<span>{{ foo }}</span>');
            gen1.generateRenderMethod(parsed1);

            const gen2 = new CodeGenerator();
            const parsed2 = await parser.parse('<span>{{ bar }}</span>');
            gen2.generateRenderMethod(parsed2);

            const compiled = CodeGenerator.generateGlobalExprTable();

            expect(compiled)
                .toContain('t.foo');
            expect(compiled)
                .toContain('t.bar');
        });

        it('should deduplicate identical expressions across components', async() =>
        {
            const parser = new TemplateParser();

            const gen1 = new CodeGenerator();
            const parsed1 = await parser.parse('<span>{{ shared }}</span>');
            gen1.generateRenderMethod(parsed1);

            const gen2 = new CodeGenerator();
            const parsed2 = await parser.parse('<span>{{ shared }}</span>');
            gen2.generateRenderMethod(parsed2);

            const assignments1 = gen1.generateExpressionAssignments();
            const assignments2 = gen2.generateExpressionAssignments();

            expect(assignments1)
                .toContain('FluffBase.__e[0] =');
            expect(assignments2)
                .toContain('FluffBase.__e[0] =');

            const compiled = CodeGenerator.generateGlobalExprTable();
            const matches = compiled.match(/t\.shared/g);
            expect(matches?.length)
                .toBe(1);
        });
    });

    describe('control flow elements', () =>
    {
        it('should generate comment markers for @if with branches', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator(new Set(), 'test-component');

            const template = `
                @if (condition) {
                    <span>true</span>
                } @else {
                    <span>false</span>
                }
            `;

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<!--fluff:if:');
            expect(html)
                .toContain('<!--/fluff:if:');
            expect(html)
                .toContain('data-fluff-branch="test-component-0-0"');
            expect(html)
                .toContain('data-fluff-branch="test-component-0-1"');
        });

        it('should generate comment markers for @for loops', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = `
                @for (item of items; track item.id) {
                    <span>{{ item.name }}</span>
                }
            `;

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<!--fluff:for:');
            expect(html)
                .toContain('<!--/fluff:for:');
            expect(html)
                .toContain('data-fluff-tpl=');
            expect(html)
                .toContain('<template');
        });

        it('should generate comment markers for interpolations', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<span>{{ message }}</span>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<!--fluff:text:');
            expect(html)
                .toContain('<!--/fluff:text:');
        });
    });

    describe('HTML comments', () =>
    {
        it('should preserve comments without parsing control flow inside them', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<!-- @if (commented) { should not parse } --><div>content</div>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<!-- @if (commented) { should not parse } -->');
            expect(html)
                .not
                .toContain('<!--fluff:if:');
        });
    });

    describe('x-fluff-component attribute', () =>
    {
        it('should add x-fluff-component attribute to custom elements', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator(new Set(['my-component']));

            const template = `
                <div>
                    <my-component [prop]="value"></my-component>
                    <span>text</span>
                </div>
            `;

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<my-component x-fluff-component');
            expect(html)
                .not
                .toContain('<div x-fluff-component');
            expect(html)
                .not
                .toContain('<span x-fluff-component');
        });

        it('should not add x-fluff-component attribute to restricted elements', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<select><option>test</option></select>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .not
                .toContain('x-fluff-component');
        });
    });

    describe('interpolation with pipes', () =>
    {
        it('should generate comment markers for interpolations with pipes', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<div>{{ name | uppercase }}</div>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<!--fluff:text:');
            expect(html)
                .toContain('<!--/fluff:text:');
        });

        it('should generate comment markers for interpolations without pipes', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<div>{{ name }}</div>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<!--fluff:text:');
            expect(html)
                .toContain('<!--/fluff:text:');
        });
    });

    describe('@for inside select element', () =>
    {
        it('should use comment markers for @for inside select element', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<select>@for (p of priorities; track p) { <option [value]="p">{{ p }}</option> }</select>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<select');
            expect(html)
                .toContain('<!--fluff:for:');
            expect(html)
                .toContain('<!--/fluff:for:');
        });

        it('should use comment markers for @for inside table element', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<table><tbody>@for (row of rows; track row.id) { <tr><td>{{ row.name }}</td></tr> }</tbody></table>';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('<table');
            expect(html)
                .toContain('<tbody');
            expect(html)
                .toContain('<!--fluff:for:');
            expect(html)
                .toContain('<!--/fluff:for:');
        });
    });

    describe('template refs (#ref)', () =>
    {
        it('should render data-ref attribute for elements with #ref binding', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<input #myInput type="text" />';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('data-ref="myInput"');
        });

        it('should render data-ref attributes for multiple refs', async() =>
        {
            const parser = new TemplateParser();
            const generator = new CodeGenerator();

            const template = '<input #firstName /><input #lastName />';

            const parsed = await parser.parse(template);
            const renderMethod = generator.generateRenderMethod(parsed);
            const html = extractHtml(renderMethod);

            expect(html)
                .toContain('data-ref="firstName"');
            expect(html)
                .toContain('data-ref="lastName"');
        });
    });

});
