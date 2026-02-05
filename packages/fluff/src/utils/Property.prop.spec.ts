import { describe, expect, it } from 'vitest';
import { Property } from './Property.js';

describe('Property.prop()', () =>
{
    it('should return undefined when no parent property is linked', () =>
    {
        const prop = new Property<number>({ initialValue: 42 });

        expect(prop.prop()).toBeUndefined();
    });

    it('should return the parent property when linked via setValue', () =>
    {
        const parent = new Property<number>({ initialValue: 10 });
        const child = new Property<number>({ initialValue: 0 });

        child.setValue(parent);

        expect(child.prop()).toBe(parent);
    });

    it('should return the root parent when chained', () =>
    {
        const root = new Property<number>({ initialValue: 5 });
        const middle = new Property<number>({ initialValue: 0 });
        const child = new Property<number>({ initialValue: 0 });

        middle.setValue(root);
        child.setValue(middle);

        expect(child.prop()).toBe(root);
    });

    it('should allow access to parent property metadata', () =>
    {
        const parent = new Property<number>({ initialValue: 100, propertyName: 'volume' });
        const child = new Property<number>({ initialValue: 0 });

        child.setValue(parent);

        const linkedParent = child.prop();
        expect(linkedParent).toBeDefined();
        expect(linkedParent?.getValue()).toBe(100);
    });

    it('should emit onChange when linking to a parent property', () =>
    {
        const parent = new Property<number>({ initialValue: 42 });
        const child = new Property<number>({ initialValue: 0 });

        let emittedValue: number | undefined = undefined;
        child.onChange.subscribe((val) =>
        {
            emittedValue = val;
        });

        child.setValue(parent);

        expect(emittedValue).toBe(42);
    });
});
