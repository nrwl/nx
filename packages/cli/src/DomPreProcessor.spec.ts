import he from 'he';
import { describe, expect, it } from 'vitest';
import { DomPreProcessor } from './DomPreProcessor.js';
import { TemplateParser } from './TemplateParser.js';

describe('DomPreProcessor', () =>
{
    describe('x-fluff-subscribe attribute', () =>
    {
        it('should parse single subscribe binding and add to property binding', async() =>
        {
            const processor = new DomPreProcessor();
            const html = '<my-component [tasks]="getTasks()" x-fluff-subscribe="tasks:filteredTasks"></my-component>';
            const result = await processor.process(html);

            expect(result)
                .toContain('x-fluff-attrib-tasks');
            expect(result)
                .not
                .toContain('x-fluff-subscribe');

            const tasksMatch = /x-fluff-attrib-tasks="([^"]*)"/.exec(result);
            expect(tasksMatch)
                .toBeTruthy();
            const tasksBindingRaw: unknown = JSON.parse(he.decode(tasksMatch?.[1] ?? ''));
            expect(tasksBindingRaw)
                .toHaveProperty('subscribe', 'filteredTasks');
        });

        it('should parse multiple comma-separated subscribe bindings', async() =>
        {
            const processor = new DomPreProcessor();
            const html = '<my-component [tasks]="getTasks()" [users]="getUsers()" x-fluff-subscribe="tasks:filteredTasks,users:allUsers"></my-component>';
            const result = await processor.process(html);

            expect(result)
                .toContain('x-fluff-attrib-tasks');
            expect(result)
                .toContain('x-fluff-attrib-users');

            const tasksMatch = /x-fluff-attrib-tasks="([^"]*)"/.exec(result);
            expect(tasksMatch)
                .toBeTruthy();
            const tasksBindingRaw: unknown = JSON.parse(he.decode(tasksMatch?.[1] ?? ''));
            expect(tasksBindingRaw)
                .toHaveProperty('subscribe', 'filteredTasks');

            const usersMatch = /x-fluff-attrib-users="([^"]*)"/.exec(result);
            expect(usersMatch)
                .toBeTruthy();
            const usersBindingRaw: unknown = JSON.parse(he.decode(usersMatch?.[1] ?? ''));
            expect(usersBindingRaw)
                .toHaveProperty('subscribe', 'allUsers');
        });

        it('should not add subscribe to bindings not listed in x-fluff-subscribe', async() =>
        {
            const processor = new DomPreProcessor();
            const html = '<my-component [tasks]="getTasks()" [other]="getOther()" x-fluff-subscribe="tasks:filteredTasks"></my-component>';
            const result = await processor.process(html);

            const tasksMatch = /x-fluff-attrib-tasks="([^"]*)"/.exec(result);
            expect(tasksMatch)
                .toBeTruthy();
            const tasksBindingRaw: unknown = JSON.parse(he.decode(tasksMatch?.[1] ?? ''));
            expect(tasksBindingRaw)
                .toHaveProperty('subscribe', 'filteredTasks');

            const otherMatch = /x-fluff-attrib-other="([^"]*)"/.exec(result);
            expect(otherMatch)
                .toBeTruthy();
            const otherBindingRaw: unknown = JSON.parse(he.decode(otherMatch?.[1] ?? ''));
            expect(otherBindingRaw)
                .not
                .toHaveProperty('subscribe');
        });

        it('should allow x-fluff-subscribe but reject other x-fluff-* attributes', async() =>
        {
            const processor = new DomPreProcessor();

            const validHtml = '<my-component [tasks]="getTasks()" x-fluff-subscribe="tasks:filteredTasks"></my-component>';
            const validResult = await processor.process(validHtml);
            expect(validResult)
                .toContain('x-fluff-attrib-tasks');

            const processor2 = new DomPreProcessor();
            const invalidHtml = '<my-component x-fluff-invalid="test"></my-component>';
            await expect(processor2.process(invalidHtml))
                .rejects
                .toThrow('Security');
        });
    });
});

describe('TemplateParser x-fluff-subscribe integration', () =>
{
    it('should include subscribe property in parsed binding info', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [tasks]="getTasks()" x-fluff-subscribe="tasks:filteredTasks"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const tasksBinding = element.bindings.find(b => b.name === 'tasks');
        expect(tasksBinding)
            .toBeDefined();
        expect(tasksBinding?.subscribe)
            .toBe('filteredTasks');
    });

    it('should not add subscribe to bindings without x-fluff-subscribe', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [tasks]="getTasks()" [other]="getOther()" x-fluff-subscribe="tasks:filteredTasks"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const tasksBinding = element.bindings.find(b => b.name === 'tasks');
        expect(tasksBinding?.subscribe)
            .toBe('filteredTasks');

        const otherBinding = element.bindings.find(b => b.name === 'other');
        expect(otherBinding?.subscribe)
            .toBeUndefined();
    });
});

describe('TemplateParser property binding with pipes', () =>
{
    it('should extract pipe in property binding', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [model]="device.spkModel | GetModel"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const modelBinding = element.bindings.find(b => b.name === 'model');
        expect(modelBinding)
            .toBeDefined();
        expect(modelBinding?.expression)
            .toContain('device');
        expect(modelBinding?.expression)
            .toContain('spkModel');
        expect(modelBinding?.pipes)
            .toHaveLength(1);
        expect(modelBinding?.pipes?.[0].name)
            .toBe('GetModel');
    });

    it('should extract pipe with arguments in property binding', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [value]="amount | currency:\'USD\'"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const valueBinding = element.bindings.find(b => b.name === 'value');
        expect(valueBinding)
            .toBeDefined();
        expect(valueBinding?.expression)
            .toContain('amount');
        expect(valueBinding?.pipes)
            .toHaveLength(1);
        expect(valueBinding?.pipes?.[0].name)
            .toBe('currency');
        expect(valueBinding?.pipes?.[0].args)
            .toContain('\'USD\'');
    });

    it('should extract multiple chained pipes in property binding', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [text]="name | lowercase | capitalize"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const textBinding = element.bindings.find(b => b.name === 'text');
        expect(textBinding)
            .toBeDefined();
        expect(textBinding?.expression)
            .toContain('name');
        expect(textBinding?.pipes)
            .toHaveLength(2);
        expect(textBinding?.pipes?.[0].name)
            .toBe('lowercase');
        expect(textBinding?.pipes?.[1].name)
            .toBe('capitalize');
    });

    it('should not treat || as pipe in property binding', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [value]="a || b"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const valueBinding = element.bindings.find(b => b.name === 'value');
        expect(valueBinding)
            .toBeDefined();
        expect(valueBinding?.expression)
            .toContain('||');
        expect(valueBinding?.pipes)
            .toBeUndefined();
    });

    it('should handle bitwise OR inside parentheses before pipe', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [value]="(flags | mask) | FormatFlags"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const valueBinding = element.bindings.find(b => b.name === 'value');
        expect(valueBinding)
            .toBeDefined();
        expect(valueBinding?.expression)
            .toContain('flags');
        expect(valueBinding?.expression)
            .toContain('mask');
        expect(valueBinding?.pipes)
            .toHaveLength(1);
        expect(valueBinding?.pipes?.[0].name)
            .toBe('FormatFlags');
    });

    it('should handle ternary expression without parentheses before pipe', async() =>
    {
        const parser = new TemplateParser();
        const html = '<my-component [value]="isActive ? activeValue : inactiveValue | Format"></my-component>';
        const ast = await parser.parse(html);

        const [element] = ast.root;
        expect(element.type)
            .toBe('element');
        if (element.type !== 'element') return;

        const valueBinding = element.bindings.find(b => b.name === 'value');
        expect(valueBinding)
            .toBeDefined();
        expect(valueBinding?.expression)
            .toContain('isActive');
        expect(valueBinding?.expression)
            .toContain('activeValue');
        expect(valueBinding?.expression)
            .toContain('inactiveValue');
        expect(valueBinding?.pipes)
            .toHaveLength(1);
        expect(valueBinding?.pipes?.[0].name)
            .toBe('Format');
    });
});

describe('DomPreProcessor attribute interpolation', () =>
{
    it('should convert attribute with interpolation to property binding', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<span class="priority-indicator {{ priorityClass }}"></span>';
        const result = await processor.process(html);

        expect(result)
            .toContain('x-fluff-attrib-class');
        expect(result)
            .not
            .toContain('{{ priorityClass }}');

        const classMatch = /x-fluff-attrib-class="([^"]*)"/.exec(result);
        expect(classMatch)
            .toBeTruthy();
        const classBindingRaw: unknown = JSON.parse(he.decode(classMatch?.[1] ?? ''));
        expect(classBindingRaw)
            .toHaveProperty('binding', 'property');
        expect(classBindingRaw)
            .toHaveProperty('expression');
    });

    it('should handle multiple interpolations in same attribute', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<div class="{{ baseClass }} {{ modifierClass }}"></div>';
        const result = await processor.process(html);

        expect(result)
            .toContain('x-fluff-attrib-class');
        expect(result)
            .not
            .toContain('{{ baseClass }}');
        expect(result)
            .not
            .toContain('{{ modifierClass }}');
    });

    it('should handle interpolation in non-class attributes', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<input placeholder="Hello {{ name }}">';
        const result = await processor.process(html);

        expect(result)
            .toContain('x-fluff-attrib-placeholder');
        expect(result)
            .not
            .toContain('{{ name }}');
    });

    it('should preserve attributes without interpolation', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<span class="static-class" id="my-id"></span>';
        const result = await processor.process(html);

        expect(result)
            .toContain('class="static-class"');
        expect(result)
            .toContain('id="my-id"');
        expect(result)
            .not
            .toContain('x-fluff-attrib');
    });
});

describe('DomPreProcessor text interpolation with pipes', () =>
{
    it('should include pipes attribute on x-fluff-text element', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<div>{{ task.title | uppercase }}</div>';
        const result = await processor.process(html);

        expect(result)
            .toContain('x-fluff-text');
        expect(result)
            .toContain('x-fluff-pipes');
    });

    it('should include pipe name in pipes attribute', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<div>{{ name | uppercase }}</div>';
        const result = await processor.process(html);

        expect(result)
            .toContain('x-fluff-pipes');
        const pipesMatch = /x-fluff-pipes="([^"]*)"/.exec(result);
        expect(pipesMatch)
            .toBeTruthy();
        const pipesValue = he.decode(pipesMatch?.[1] ?? '');
        const parsed: unknown = JSON.parse(pipesValue);
        expect(Array.isArray(parsed))
            .toBe(true);
        if (!Array.isArray(parsed)) throw new Error('Expected array');
        const firstPipe: unknown = parsed[0];
        expect(firstPipe)
            .toHaveProperty('name', 'uppercase');
    });

    it('should include pipe with arguments', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<div>{{ description | truncate:80 }}</div>';
        const result = await processor.process(html);

        expect(result)
            .toContain('x-fluff-pipes');
        const pipesMatch = /x-fluff-pipes="([^"]*)"/.exec(result);
        expect(pipesMatch)
            .toBeTruthy();
        const pipesValue2 = he.decode(pipesMatch?.[1] ?? '');
        const parsed2: unknown = JSON.parse(pipesValue2);
        expect(Array.isArray(parsed2))
            .toBe(true);
        if (!Array.isArray(parsed2)) throw new Error('Expected array');
        const pipe: unknown = parsed2[0];
        expect(pipe)
            .toHaveProperty('name', 'truncate');
        expect(pipe)
            .toHaveProperty('args', ['80']);
    });

    it('should not include pipes attribute when no pipes used', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<div>{{ task.title }}</div>';
        const result = await processor.process(html);

        expect(result)
            .toContain('x-fluff-text');
        expect(result)
            .not
            .toContain('x-fluff-pipes');
    });
});

describe('TemplateParser text interpolation with pipes', () =>
{
    it('should include pipes in InterpolationNode', async() =>
    {
        const parser = new TemplateParser();
        const html = '<div>{{ name | uppercase }}</div>';
        const ast = await parser.parse(html);

        const [div] = ast.root;
        expect(div.type)
            .toBe('element');
        if (div.type !== 'element') return;

        const [interpolation] = div.children;
        expect(interpolation.type)
            .toBe('interpolation');
        if (interpolation.type !== 'interpolation') return;

        expect(interpolation.pipes)
            .toBeDefined();
        expect(interpolation.pipes?.[0].name)
            .toBe('uppercase');
    });

    it('should include pipe arguments in InterpolationNode', async() =>
    {
        const parser = new TemplateParser();
        const html = '<div>{{ description | truncate:80 }}</div>';
        const ast = await parser.parse(html);

        const [div2] = ast.root;
        expect(div2.type)
            .toBe('element');
        if (div2.type !== 'element') return;

        const [interpolation2] = div2.children;
        expect(interpolation2.type)
            .toBe('interpolation');
        if (interpolation2.type !== 'interpolation') return;

        expect(interpolation2.pipes)
            .toBeDefined();
        expect(interpolation2.pipes?.[0].name)
            .toBe('truncate');
        expect(interpolation2.pipes?.[0].args)
            .toContain('80');
    });
});

describe('DomPreProcessor serialization behavior', () =>
{
    it('should preserve doctype', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<!DOCTYPE html><div></div>';
        const result = await processor.process(html);

        expect(result)
            .toContain('<!DOCTYPE html>');
    });

    it('should preserve comments', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<div><!--my-comment--></div>';
        const result = await processor.process(html);

        expect(result)
            .toContain('<!--my-comment-->');
    });

    it('should rename restricted elements', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<table><tr><td>Hi</td></tr></table>';
        const result = await processor.process(html);

        expect(result)
            .toContain('<x-fluff-el-table>');
        expect(result)
            .toContain('<x-fluff-el-tr>');
        expect(result)
            .toContain('<x-fluff-el-td>Hi</x-fluff-el-td>');
        expect(result)
            .toContain('</x-fluff-el-tr>');
        expect(result)
            .toContain('</x-fluff-el-table>');
    });

    it('should escape special characters in transformed attribute JSON', async() =>
    {
        const processor = new DomPreProcessor();
        const html = '<div [title]="\'a&quot;b & c\'"></div>';
        const result = await processor.process(html);

        const match = /x-fluff-attrib-title="([^"]*)"/.exec(result);
        expect(match)
            .toBeTruthy();

        const decoded = he.decode(match?.[1] ?? '');
        const parsed: unknown = JSON.parse(decoded);
        expect(parsed)
            .toHaveProperty('name', 'title');
        expect(parsed)
            .toHaveProperty('binding', 'property');
        expect(parsed)
            .toHaveProperty('expression', '\'a"b & c\'');
    });
});

describe('Template Refs (#ref syntax)', () =>
{
    describe('DomPreProcessor', () =>
    {
        it('should transform #refName to x-fluff-attrib-ref binding', async() =>
        {
            const processor = new DomPreProcessor();
            const html = '<input #myInput type="text" />';
            const result = await processor.process(html);

            expect(result)
                .toContain('x-fluff-attrib-ref-myinput');

            const refMatch = /x-fluff-attrib-ref-myinput="([^"]*)"/.exec(result);
            expect(refMatch)
                .toBeTruthy();
            const refBinding: unknown = JSON.parse(he.decode(refMatch?.[1] ?? ''));
            expect(refBinding)
                .toHaveProperty('binding', 'ref');
            expect(refBinding)
                .toHaveProperty('name', 'myInput');
        });

        it('should handle multiple template refs on different elements', async() =>
        {
            const processor = new DomPreProcessor();
            const html = '<input #firstName /><input #lastName />';
            const result = await processor.process(html);

            expect(result)
                .toContain('x-fluff-attrib-ref-firstname');
            expect(result)
                .toContain('x-fluff-attrib-ref-lastname');
        });

        it('should preserve ref name casing in binding but lowercase attribute name', async() =>
        {
            const processor = new DomPreProcessor();
            const html = '<div #myComplexRefName></div>';
            const result = await processor.process(html);

            expect(result)
                .toContain('x-fluff-attrib-ref-mycomplexrefname');

            const refMatch = /x-fluff-attrib-ref-mycomplexrefname="([^"]*)"/.exec(result);
            const refBinding: unknown = JSON.parse(he.decode(refMatch?.[1] ?? ''));
            expect(refBinding)
                .toHaveProperty('name', 'myComplexRefName');
        });
    });

    describe('TemplateParser templateRefs collection', () =>
    {
        it('should collect template refs from parsed template', async() =>
        {
            const parser = new TemplateParser();
            const html = '<input #myInput type="text" />';
            const result = await parser.parse(html);

            expect(result.templateRefs)
                .toContain('myInput');
        });

        it('should collect multiple template refs', async() =>
        {
            const parser = new TemplateParser();
            const html = '<input #firstName /><input #lastName /><button #submitBtn>Submit</button>';
            const result = await parser.parse(html);

            expect(result.templateRefs)
                .toContain('firstName');
            expect(result.templateRefs)
                .toContain('lastName');
            expect(result.templateRefs)
                .toContain('submitBtn');
            expect(result.templateRefs.length)
                .toBe(3);
        });

        it('should return empty templateRefs when no refs in template', async() =>
        {
            const parser = new TemplateParser();
            const html = '<div><span>No refs here</span></div>';
            const result = await parser.parse(html);

            expect(result.templateRefs)
                .toEqual([]);
        });

        it('should include ref binding in element bindings array', async() =>
        {
            const parser = new TemplateParser();
            const html = '<input #myInput type="text" />';
            const result = await parser.parse(html);

            const [input] = result.root;
            expect(input.type)
                .toBe('element');
            if (input.type !== 'element') return;

            const refBinding = input.bindings.find(b => b.binding === 'ref');
            expect(refBinding)
                .toBeDefined();
            expect(refBinding?.name)
                .toBe('myInput');
        });

        it('should transform template ref used in event handler to DOM element lookup', async() =>
        {
            const parser = new TemplateParser();
            const html = '<input #myInput type="text" /><button (click)="focusInput(myInput)">Focus</button>';
            const result = await parser.parse(html);

            const button = result.root.find(n => n.type === 'element' && n.tagName === 'button');
            expect(button?.type)
                .toBe('element');
            if (button?.type !== 'element') return;

            const clickBinding = button.bindings.find(b => b.name === 'click');
            expect(clickBinding)
                .toBeDefined();
            expect(clickBinding?.expression)
                .toContain('__getShadowRoot');
            expect(clickBinding?.expression)
                .toContain('data-ref=');
            expect(clickBinding?.expression)
                .toContain('myInput');
        });
    });
});
