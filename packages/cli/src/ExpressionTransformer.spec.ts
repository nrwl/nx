import { describe, expect, it } from 'vitest';
import { ExpressionTransformer } from './ExpressionTransformer.js';

describe('ExpressionTransformer', () =>
{
    describe('transformExpression', () =>
    {
        it('should add this prefix to simple identifier', () =>
        {
            const result = ExpressionTransformer.transformExpression('name');
            expect(result)
                .toBe('this.name');
        });

        it('should add this prefix to property access', () =>
        {
            const result = ExpressionTransformer.transformExpression('user.name');
            expect(result)
                .toBe('this.user.name');
        });

        it('should add this prefix to nested property access', () =>
        {
            const result = ExpressionTransformer.transformExpression('user.profile.avatar');
            expect(result)
                .toBe('this.user.profile.avatar');
        });

        it('should add this prefix to method call', () =>
        {
            const result = ExpressionTransformer.transformExpression('getData()');
            expect(result)
                .toBe('this.getData()');
        });

        it('should add this prefix to method call with arguments', () =>
        {
            const result = ExpressionTransformer.transformExpression('format(value, "USD")');
            expect(result)
                .toBe('this.format(this.value,"USD")');
        });

        it('should not add this prefix to literals', () =>
        {
            expect(ExpressionTransformer.transformExpression('true'))
                .toBe('true');
            expect(ExpressionTransformer.transformExpression('false'))
                .toBe('false');
            expect(ExpressionTransformer.transformExpression('null'))
                .toBe('null');
            expect(ExpressionTransformer.transformExpression('undefined'))
                .toBe('undefined');
        });

        it('should not add this prefix to numbers', () =>
        {
            expect(ExpressionTransformer.transformExpression('42'))
                .toBe('42');
            expect(ExpressionTransformer.transformExpression('3.14'))
                .toBe('3.14');
        });

        it('should not add this prefix to strings', () =>
        {
            expect(ExpressionTransformer.transformExpression('"hello"'))
                .toBe('"hello"');
            expect(ExpressionTransformer.transformExpression('\'world\''))
                .toBe('\'world\'');
        });

        it('should handle binary expressions', () =>
        {
            const result = ExpressionTransformer.transformExpression('a + b');
            expect(result)
                .toBe('this.a+this.b');
        });

        it('should handle comparison expressions', () =>
        {
            const result = ExpressionTransformer.transformExpression('count > 10');
            expect(result)
                .toBe('this.count>10');
        });

        it('should handle logical expressions', () =>
        {
            const result = ExpressionTransformer.transformExpression('a && b || c');
            expect(result)
                .toBe('this.a&&this.b||this.c');
        });

        it('should handle ternary expressions', () =>
        {
            const result = ExpressionTransformer.transformExpression('isActive ? "yes" : "no"');
            expect(result)
                .toBe('this.isActive?"yes":"no"');
        });

        it('should handle array access', () =>
        {
            const result = ExpressionTransformer.transformExpression('items[0]');
            expect(result)
                .toBe('this.items[0]');
        });

        it('should handle dynamic property access', () =>
        {
            const result = ExpressionTransformer.transformExpression('obj[key]');
            expect(result)
                .toBe('this.obj[this.key]');
        });

        it('should not prefix localsObjectName with this when rewriting locals', () =>
        {
            const result = ExpressionTransformer.transformExpression('p', {
                addThisPrefix: true,
                localVars: ['p'],
                localsObjectName: 'l'
            });
            expect(result)
                .toBe('l.p');
        });

        it('should handle optional chaining', () =>
        {
            const result = ExpressionTransformer.transformExpression('user?.name');
            expect(result)
                .toBe('this.user?.name');
        });

        it('should handle nullish coalescing', () =>
        {
            const result = ExpressionTransformer.transformExpression('value ?? defaultValue');
            expect(result)
                .toBe('this.value??this.defaultValue');
        });

        it('should handle arrow functions', () =>
        {
            const result = ExpressionTransformer.transformExpression('items.filter(x => x.active)');
            expect(result)
                .toContain('this.items.filter');
            expect(result)
                .toContain('active');
        });

        it('should handle template literals', () =>
        {
            const result = ExpressionTransformer.transformExpression('`Hello ${name}`');
            expect(result)
                .toBe('`Hello ${this.name}`');
        });

        it('should handle unary expressions', () =>
        {
            const result = ExpressionTransformer.transformExpression('!isHidden');
            expect(result)
                .toBe('!this.isHidden');
        });

        it('should handle negation of complex expression', () =>
        {
            const result = ExpressionTransformer.transformExpression('!(a && b)');
            expect(result)
                .toBe('!(this.a&&this.b)');
        });

        it('should respect localVars option', () =>
        {
            const result = ExpressionTransformer.transformExpression('item.name', { localVars: ['item'] });
            expect(result)
                .toBe('item.name');
        });

        it('should handle mixed local and this vars', () =>
        {
            const result = ExpressionTransformer.transformExpression('item.value + globalValue', { localVars: ['item'] });
            expect(result)
                .toBe('item.value+this.globalValue');
        });

        it('should handle iterator replacement', () =>
        {
            const result = ExpressionTransformer.transformForExpression('item', 'item', '__items[__idx]');
            expect(result)
                .toBe('__items[__idx]');
        });

        it('should add optional chaining when nullSafe is true', () =>
        {
            const result = ExpressionTransformer.transformExpression('user.profile.name', { nullSafe: true });
            expect(result)
                .toContain('?.');
        });

        it('should not add this prefix when addThisPrefix is false', () =>
        {
            const result = ExpressionTransformer.transformExpression('name', { addThisPrefix: false });
            expect(result)
                .toBe('name');
        });

        it('should not add this prefix to $event', () =>
        {
            const result = ExpressionTransformer.transformExpression('$event.target.value');
            expect(result)
                .toBe('$event.target.value');
        });

        it('should not add this prefix to $event in method call', () =>
        {
            const result = ExpressionTransformer.transformExpression('setSearch($event.target.value)');
            expect(result)
                .toBe('this.setSearch($event.target.value)');
        });

        it('should not add this prefix to $event in complex expression', () =>
        {
            const result = ExpressionTransformer.transformExpression('$event.target.checked ? "yes" : "no"');
            expect(result)
                .toBe('$event.target.checked?"yes":"no"');
        });

        it('should replace $event when eventReplacementName is provided', () =>
        {
            const result = ExpressionTransformer.transformExpression('setSearch($event.target.value)', {
                eventReplacementName: 'e'
            });
            expect(result)
                .toBe('this.setSearch(e.target.value)');
        });
    });

    describe('addThisPrefix', () =>
    {
        it('should add this prefix to expression', () =>
        {
            expect(ExpressionTransformer.addThisPrefix('count'))
                .toBe('this.count');
        });

        it('should handle complex expressions', () =>
        {
            expect(ExpressionTransformer.addThisPrefix('items.length'))
                .toBe('this.items.length');
        });
    });

    describe('addThisPrefixSafe', () =>
    {
        it('should add this prefix with null safety', () =>
        {
            const result = ExpressionTransformer.addThisPrefixSafe('user.profile.name');
            expect(result)
                .toContain('this.user');
            expect(result)
                .toContain('?.');
        });

        it('should handle simple property', () =>
        {
            const result = ExpressionTransformer.addThisPrefixSafe('name');
            expect(result)
                .toBe('this.name');
        });
    });

    describe('transformForExpression', () =>
    {
        it('should replace iterator with replacement', () =>
        {
            const result = ExpressionTransformer.transformForExpression('item', 'item', '__items[__idx]');
            expect(result)
                .toBe('__items[__idx]');
        });

        it('should handle iterator property access', () =>
        {
            const result = ExpressionTransformer.transformForExpression('item.name', 'item', '__items[__idx]');
            expect(result)
                .toBe('__items[__idx].name');
        });

        it('should add this prefix to non-iterator vars', () =>
        {
            const result = ExpressionTransformer.transformForExpression('globalValue', 'item', '__items[__idx]');
            expect(result)
                .toBe('this.globalValue');
        });

        it('should handle mixed iterator and global vars', () =>
        {
            const result = ExpressionTransformer.transformForExpression('item.value + offset', 'item', '__items[__idx]');
            expect(result)
                .toBe('__items[__idx].value+this.offset');
        });
    });

    describe('transformForExpressionKeepIterator', () =>
    {
        it('should keep iterator as local var', () =>
        {
            const result = ExpressionTransformer.transformForExpressionKeepIterator('item.name', 'item');
            expect(result)
                .toBe('item.name');
        });

        it('should add this prefix to non-iterator vars', () =>
        {
            const result = ExpressionTransformer.transformForExpressionKeepIterator('globalValue', 'item');
            expect(result)
                .toBe('this.globalValue');
        });

        it('should handle complex expression with iterator', () =>
        {
            const result = ExpressionTransformer.transformForExpressionKeepIterator('item.value + offset', 'item');
            expect(result)
                .toBe('item.value+this.offset');
        });
    });

    describe('parsePrimaryExpression', () =>
    {
        it('should parse expression without pipes', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes)
                .toHaveLength(0);
        });

        it('should parse expression with single pipe', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | uppercase');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes)
                .toHaveLength(1);
            expect(result.pipes[0].name)
                .toBe('uppercase');
            expect(result.pipes[0].args)
                .toHaveLength(0);
        });

        it('should parse expression with pipe and argument', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | truncate:50');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes)
                .toHaveLength(1);
            expect(result.pipes[0].name)
                .toBe('truncate');
            expect(result.pipes[0].args)
                .toEqual(['50']);
        });

        it('should parse expression with pipe and multiple arguments', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('date | format:"YYYY-MM-DD":"UTC"');
            expect(result.expression)
                .toBe('date');
            expect(result.pipes)
                .toHaveLength(1);
            expect(result.pipes[0].name)
                .toBe('format');
            expect(result.pipes[0].args)
                .toEqual(['"YYYY-MM-DD"', '"UTC"']);
        });

        it('should parse expression with multiple pipes', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | lowercase | capitalize');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes)
                .toHaveLength(2);
            expect(result.pipes[0].name)
                .toBe('lowercase');
            expect(result.pipes[1].name)
                .toBe('capitalize');
        });

        it('should parse chained pipes with arguments', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('text | uppercase');
            expect(result.expression)
                .toBe('text');
            expect(result.pipes)
                .toHaveLength(1);
            expect(result.pipes[0].name)
                .toBe('uppercase');
        });

        it('should not confuse || operator with pipe', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('a || b');
            expect(result.expression)
                .toBe('a || b');
            expect(result.pipes)
                .toHaveLength(0);
        });

        it('should handle property access before pipe', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('user.name | uppercase');
            expect(result.expression)
                .toBe('user.name');
            expect(result.pipes[0].name)
                .toBe('uppercase');
        });

        it('should handle method call before pipe', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('getValue() | format');
            expect(result.expression)
                .toBe('getValue()');
            expect(result.pipes[0].name)
                .toBe('format');
        });

        it('should handle complex expression before pipe', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('items.filter(x => x.active).length | number');
            expect(result.expression)
                .toBe('items.filter(x => x.active).length');
            expect(result.pipes[0].name)
                .toBe('number');
        });

        it('should handle pipe argument with arithmetic expression', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('text | truncate:maxLength + 10');
            expect(result.expression)
                .toBe('text');
            expect(result.pipes)
                .toHaveLength(1);
            expect(result.pipes[0].name)
                .toBe('truncate');
            expect(result.pipes[0].args)
                .toEqual(['maxLength + 10']);
        });

        it('should handle pipe argument with variable reference', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | format:formatString');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes[0].name)
                .toBe('format');
            expect(result.pipes[0].args)
                .toEqual(['formatString']);
        });

        it('should handle pipe argument with method call', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('data | transform:getConfig()');
            expect(result.expression)
                .toBe('data');
            expect(result.pipes[0].name)
                .toBe('transform');
            expect(result.pipes[0].args)
                .toEqual(['getConfig()']);
        });

        it('should handle pipe argument with ternary expression (must be wrapped in parens)', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | format:(isShort ? "short" : "long")');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes[0].name)
                .toBe('format');
            expect(result.pipes[0].args)
                .toEqual(['(isShort ? "short" : "long")']);
        });

        it('should handle pipe argument with nested parentheses', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | calc:(a + b) * c');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes[0].name)
                .toBe('calc');
            expect(result.pipes[0].args)
                .toEqual(['(a + b) * c']);
        });

        it('should handle multiple pipe arguments with expressions', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | slice:start:end + 1');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes[0].name)
                .toBe('slice');
            expect(result.pipes[0].args)
                .toEqual(['start', 'end + 1']);
        });

        it('should handle chained pipes with complex arguments', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('text | truncate:maxLen | append:"..."');
            expect(result.expression)
                .toBe('text');
            expect(result.pipes)
                .toHaveLength(2);
            expect(result.pipes[0].name)
                .toBe('truncate');
            expect(result.pipes[0].args)
                .toEqual(['maxLen']);
            expect(result.pipes[1].name)
                .toBe('append');
            expect(result.pipes[1].args)
                .toEqual(['"..."']);
        });

        it('should handle pipe argument with object literal', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('data | format:{style: "currency", currency: "USD"}');
            expect(result.expression)
                .toBe('data');
            expect(result.pipes[0].name)
                .toBe('format');
            expect(result.pipes[0].args)
                .toEqual(['{style: "currency", currency: "USD"}']);
        });

        it('should handle pipe argument with array literal', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('items | filter:[1, 2, 3]');
            expect(result.expression)
                .toBe('items');
            expect(result.pipes[0].name)
                .toBe('filter');
            expect(result.pipes[0].args)
                .toEqual(['[1, 2, 3]']);
        });

        it('should handle expression with bitwise OR inside parentheses before pipe', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('(flags | mask) | format');
            expect(result.expression)
                .toBe('(flags | mask)');
            expect(result.pipes[0].name)
                .toBe('format');
        });

        it('should handle pipe with property access argument', () =>
        {
            const result = ExpressionTransformer.parsePrimaryExpression('value | format:config.dateFormat');
            expect(result.expression)
                .toBe('value');
            expect(result.pipes[0].name)
                .toBe('format');
            expect(result.pipes[0].args)
                .toEqual(['config.dateFormat']);
        });
    });

    describe('transformInterpolation', () =>
    {
        it('should transform simple expression', () =>
        {
            const result = ExpressionTransformer.transformInterpolation('name');
            expect(result)
                .toContain('this.name');
            expect(result)
                .toContain('??""');
        });

        it('should transform expression with pipe', () =>
        {
            const result = ExpressionTransformer.transformInterpolation('name | uppercase');
            expect(result)
                .toContain('__pipe("uppercase"');
        });

        it('should handle iterator variable', () =>
        {
            const result = ExpressionTransformer.transformInterpolation('item.name', 'item');
            expect(result)
                .toContain('item.name');
            expect(result)
                .not
                .toContain('this.item');
        });

        it('should add this prefix to non-iterator vars with iterator context', () =>
        {
            const result = ExpressionTransformer.transformInterpolation('globalValue', 'item');
            expect(result)
                .toContain('this.globalValue');
        });
    });

    describe('extractRootIdentifier', () =>
    {
        it('should extract simple identifier', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('name'))
                .toBe('name');
        });

        it('should extract root from property access', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('user.name'))
                .toBe('user');
        });

        it('should extract root from deep property access', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('user.profile.avatar.url'))
                .toBe('user');
        });

        it('should extract root from method call', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('getData()'))
                .toBe('getData');
        });

        it('should extract root from chained method calls', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('items.filter().map()'))
                .toBe('items');
        });

        it('should extract root from optional chaining', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('user?.profile?.name'))
                .toBe('user');
        });

        it('should extract root from binary expression', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('a + b'))
                .toBe('a');
        });

        it('should extract root from logical expression', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('a && b'))
                .toBe('a');
        });

        it('should extract root from unary expression', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('!isHidden'))
                .toBe('isHidden');
        });

        it('should extract root from conditional expression', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('cond ? a : b'))
                .toBe('cond');
        });

        it('should extract root from array access', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('items[0]'))
                .toBe('items');
        });

        it('should return null for non-identifier root', () =>
        {
            expect(ExpressionTransformer.extractRootIdentifier('42'))
                .toBeNull();
            expect(ExpressionTransformer.extractRootIdentifier('"string"'))
                .toBeNull();
        });
    });

    describe('parseInterpolations', () =>
    {
        it('should parse single interpolation', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('Hello {{ name }}!');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('name');
            expect(result[0].start)
                .toBe(6);
            expect(result[0].end)
                .toBe(16);
        });

        it('should parse multiple interpolations', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ first }} and {{ second }}');
            expect(result)
                .toHaveLength(2);
            expect(result[0].expr)
                .toBe('first');
            expect(result[1].expr)
                .toBe('second');
        });

        it('should parse interpolation with property access', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ user.name }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('user.name');
        });

        it('should parse interpolation with method call', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ getValue() }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('getValue()');
        });

        it('should parse interpolation with pipe', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ name | uppercase }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('name | uppercase');
        });

        it('should parse interpolation with pipe and args', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ date | format:"short" }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('date | format:"short"');
        });

        it('should parse interpolation with multiple pipes', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ text | lowercase | capitalize }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('text | lowercase | capitalize');
        });

        it('should handle text without interpolations', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('Plain text without interpolation');
            expect(result)
                .toHaveLength(0);
        });

        it('should handle empty string', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('');
            expect(result)
                .toHaveLength(0);
        });

        it('should handle interpolation with ternary', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ (isActive ? "Yes" : "No") }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('(isActive ? "Yes" : "No")');
        });

        it('should handle interpolation with comparison', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ count > 0 }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('count > 0');
        });

        it('should handle interpolation with logical operators', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ a && b || c }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('a && b || c');
        });

        it('should handle interpolation with array access', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ items[0].name }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('items[0].name');
        });

        it('should handle interpolation with optional chaining', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ user?.profile?.name }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('user?.profile?.name');
        });

        it('should handle adjacent interpolations', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ a }}{{ b }}');
            expect(result)
                .toHaveLength(2);
            expect(result[0].expr)
                .toBe('a');
            expect(result[1].expr)
                .toBe('b');
        });

        it('should handle interpolation with template literal', () =>
        {
            const result = ExpressionTransformer.parseInterpolations('{{ `${a}-${b}` }}');
            expect(result)
                .toHaveLength(1);
            expect(result[0].expr)
                .toBe('`${a}-${b}`');
        });
    });

    describe('transformPipedExpression', () =>
    {
        it('should return expression without pipes unchanged', () =>
        {
            const result = ExpressionTransformer.transformPipedExpression('value', false);
            expect(result)
                .toBe('value');
        });

        it('should transform single pipe', () =>
        {
            const result = ExpressionTransformer.transformPipedExpression('value | uppercase');
            expect(result)
                .toContain('__pipe("uppercase"');
        });

        it('should transform multiple pipes', () =>
        {
            const result = ExpressionTransformer.transformPipedExpression('value | lowercase | capitalize');
            expect(result)
                .toContain('__pipe("capitalize"');
            expect(result)
                .toContain('__pipe("lowercase"');
        });

        it('should include pipe arguments', () =>
        {
            const result = ExpressionTransformer.transformPipedExpression('value | truncate:50');
            expect(result)
                .toContain('__pipe("truncate"');
            expect(result)
                .toContain('50');
        });

        it('should add this prefix when option is true', () =>
        {
            const result = ExpressionTransformer.transformPipedExpression('value | uppercase', true);
            expect(result)
                .toContain('this.value');
        });
    });

    describe('renameVariable', () =>
    {
        it('should rename simple variable', () =>
        {
            const result = ExpressionTransformer.renameVariable('$event', '$event', '__ev');
            expect(result)
                .toBe('__ev');
        });

        it('should rename variable in property access', () =>
        {
            const result = ExpressionTransformer.renameVariable('$event.target.value', '$event', '__ev');
            expect(result)
                .toBe('__ev.target.value');
        });

        it('should rename variable in method call', () =>
        {
            const result = ExpressionTransformer.renameVariable('handleEvent($event)', '$event', '__ev');
            expect(result)
                .toBe('handleEvent(__ev)');
        });

        it('should not rename property with same name', () =>
        {
            const result = ExpressionTransformer.renameVariable('obj.$event', '$event', '__ev');
            expect(result)
                .toBe('obj.$event');
        });

        it('should rename multiple occurrences', () =>
        {
            const result = ExpressionTransformer.renameVariable('$event.a + $event.b', '$event', '__ev');
            expect(result)
                .toBe('__ev.a + __ev.b');
        });

        it('should handle complex expressions', () =>
        {
            const result = ExpressionTransformer.renameVariable('$event.target.checked ? "yes" : "no"', '$event', '__ev');
            expect(result)
                .toContain('__ev.target.checked');
        });
    });

    describe('expressionUsesVariable', () =>
    {
        it('should return true for simple variable usage', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('item', 'item'))
                .toBe(true);
        });

        it('should return true for variable in property access', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('item.name', 'item'))
                .toBe(true);
        });

        it('should return true for variable in method call', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('process(item)', 'item'))
                .toBe(true);
        });

        it('should return false when variable not used', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('other.name', 'item'))
                .toBe(false);
        });

        it('should return false for property with same name', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('obj.item', 'item'))
                .toBe(false);
        });

        it('should return true for variable in array access', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('items[item]', 'item'))
                .toBe(true);
        });

        it('should return true for variable in template literal', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('(`${item}`)', 'item'))
                .toBe(true);
        });

        it('should return true for variable in ternary', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('(item ? "yes" : "no")', 'item'))
                .toBe(true);
        });

        it('should return true for variable in binary expression', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('item + 1', 'item'))
                .toBe(true);
        });

        it('should handle complex nested expressions', () =>
        {
            expect(ExpressionTransformer.expressionUsesVariable('items.filter(x => x.id === item.id)', 'item'))
                .toBe(true);
        });
    });
});
