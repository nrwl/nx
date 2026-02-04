import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import { FluffElement } from './FluffElementImpl.js';
import { MarkerManager } from './MarkerManager.js';

interface SelectOption
{
    value: number;
    label: string;
}

function isSelectOption(obj: unknown): obj is SelectOption
{
    return typeof obj === 'object' && obj !== null && 'value' in obj && 'label' in obj;
}

function hasProps(t: unknown): t is { __selectedValue: Property<number>; __options: Property<SelectOption[]> }
{
    return typeof t === 'object' && t !== null && '__selectedValue' in t && '__options' in t;
}

interface SelectTestComponentInstance extends FluffElement
{
    selectedValue: number;
    options: SelectOption[];
    __selectedValue: Property<number>;
    __options: Property<SelectOption[]>;
}

type SelectTestComponentConstructor = new () => SelectTestComponentInstance;

function createSelectWithForComponent(tagName: string): SelectTestComponentConstructor
{
    class SelectWithForComponent extends FluffElement
    {
        private readonly componentTag = tagName;
        public __selectedValue = new Property<number>({ initialValue: 2, propertyName: 'selectedValue' });
        public __options = new Property<SelectOption[]>({
            initialValue: [
                { value: 1, label: 'One' },
                { value: 2, label: 'Two' },
                { value: 3, label: 'Three' }
            ],
            propertyName: 'options'
        });

        public get selectedValue(): number
        {
            return this.__selectedValue.getValue() ?? 0;
        }

        public set selectedValue(val: number)
        {
            this.__selectedValue.setValue(val);
        }

        public get options(): SelectOption[]
        {
            return this.__options.getValue() ?? [];
        }

        public set options(val: SelectOption[])
        {
            this.__options.setValue(val);
        }

        protected override __render(): void
        {
            this.__getShadowRoot().innerHTML = `
                <select data-lid="l0">
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                </select>
                <template data-fluff-tpl="${this.componentTag}-0">
                    <option data-lid="l1"></option>
                </template>
            `;

            this.__setMarkerConfigs(JSON.stringify([
                [0, { type: 'for', iterator: 'opt', iterableExprId: 0, deps: ['options'], hasEmpty: false }]
            ]));
        }

        protected override __setupBindings(): void
        {
            this.__initializeMarkers(MarkerManager);
            super.__setupBindings();
        }
    }

    SelectWithForComponent.__bindings = {
        l0: [{ n: 'value', b: 'property', e: 1, d: ['selectedValue'] }],
        l1: [
            { n: 'value', b: 'property', e: 2, d: [] },
            { n: 'textContent', b: 'property', e: 3, d: [] }
        ]
    };

    return SelectWithForComponent as SelectTestComponentConstructor;
}

describe('Select value binding with @for options', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should show correct selected value when options are rendered via @for', async() =>
    {
        const tag = 'test-select-for-' + Math.random().toString(36).slice(2);

        const SelectComponent = createSelectWithForComponent(tag);

        FluffBase.__e = [
            (t: unknown): SelectOption[] =>
            {
                if (hasProps(t))
                {
                    return t.__options.getValue() ?? [];
                }
                throw new Error('Invalid type');
            },
            (t: unknown): number =>
            {
                if (hasProps(t))
                {
                    return t.__selectedValue.getValue() ?? 0;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): number =>
            {
                const { opt } = l;
                if (isSelectOption(opt))
                {
                    return opt.value;
                }
                throw new Error('Invalid opt');
            },
            (_t: unknown, l: Record<string, unknown>): string =>
            {
                const { opt } = l;
                if (isSelectOption(opt))
                {
                    return opt.label;
                }
                throw new Error('Invalid opt');
            }
        ];

        customElements.define(tag, SelectComponent);

        const el = document.createElement(tag);
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const select = el.shadowRoot?.querySelector('select');
        expect(select).toBeDefined();

        const options = select?.querySelectorAll('option');
        expect(options?.length).toBe(3);

        expect(select?.value).toBe('2');

        el.remove();
    });
});
