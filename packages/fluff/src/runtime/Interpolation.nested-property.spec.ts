import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Property } from '../utils/Property.js';
import {
    createTestInterpolationNestedPropertyComponent
} from './tests/createTestInterpolationNestedPropertyComponent.js';
import { TestInterpolationNestedPropertyComponentBase } from './tests/TestInterpolationNestedPropertyComponentBase.js';
import {
    TestInterpolationNestedPropertyContainerClass
} from './tests/TestInterpolationNestedPropertyContainerClass.js';
import { TestHarness } from './tests/TestHarness.js';

describe('Interpolation with nested Property', () =>
{
    beforeEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should unwrap nested Property value in interpolation and display the value', async() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): Property<number> =>
            {
                if (t instanceof TestInterpolationNestedPropertyComponentBase)
                {
                    return t.hostClass.childProp;
                }
                throw new Error('Invalid type');
            }
        ], []);

        const tag = 'test-interpolation-nested-prop-' + Math.random()
            .toString(36)
            .slice(2);
        const ComponentClass = createTestInterpolationNestedPropertyComponent();
        TestHarness.defineCustomElement(tag, ComponentClass);

        const el = TestHarness.mount(tag);

        await TestHarness.waitForTimeout();

        const { shadowRoot } = el;
        expect(shadowRoot)
            .toBeDefined();

        const textContent = shadowRoot?.textContent?.trim();
        expect(textContent)
            .toBe('42');
        expect(textContent)
            .not
            .toContain('onChange');
        expect(textContent)
            .not
            .toContain('callbacks');

        el.remove();
    });

    it('should update interpolation when nested Property value changes', async() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): Property<number> =>
            {
                if (t instanceof TestInterpolationNestedPropertyComponentBase)
                {
                    return t.hostClass.childProp;
                }
                throw new Error('Invalid type');
            }
        ], []);

        const tag = 'test-interpolation-nested-prop-update-' + Math.random()
            .toString(36)
            .slice(2);
        const ComponentClass = createTestInterpolationNestedPropertyComponent();
        TestHarness.defineCustomElement(tag, ComponentClass);

        const el = TestHarness.mount(tag);
        if (!(el instanceof TestInterpolationNestedPropertyComponentBase))
        {
            throw new Error('Expected TestInterpolationNestedPropertyComponentBase');
        }

        await TestHarness.waitForTimeout();

        const { shadowRoot } = el;
        expect(shadowRoot?.textContent?.trim())
            .toBe('42');

        el.hostClass.childProp.setValue(100);

        await TestHarness.waitForTimeout();

        expect(shadowRoot?.textContent?.trim())
            .toBe('100');

        el.remove();
    });

    it('should update interpolation when parent container is replaced', async() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): Property<number> =>
            {
                if (t instanceof TestInterpolationNestedPropertyComponentBase)
                {
                    return t.hostClass.childProp;
                }
                throw new Error('Invalid type');
            }
        ], []);

        const tag = 'test-interpolation-nested-prop-replace-' + Math.random()
            .toString(36)
            .slice(2);
        const ComponentClass = createTestInterpolationNestedPropertyComponent();
        TestHarness.defineCustomElement(tag, ComponentClass);

        const el = TestHarness.mount(tag);
        if (!(el instanceof TestInterpolationNestedPropertyComponentBase))
        {
            throw new Error('Expected TestInterpolationNestedPropertyComponentBase');
        }

        await TestHarness.waitForTimeout();

        const { shadowRoot } = el;
        expect(shadowRoot?.textContent?.trim())
            .toBe('42');

        const newContainer = new TestInterpolationNestedPropertyContainerClass();
        newContainer.childProp.setValue(999);
        el.hostClass = newContainer;

        await TestHarness.waitForTimeout();

        expect(shadowRoot?.textContent?.trim())
            .toBe('999');

        el.remove();
    });
});
