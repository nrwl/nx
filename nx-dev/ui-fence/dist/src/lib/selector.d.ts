import { JSX } from 'react';
export interface SelectorProps<T> {
    children: JSX.Element;
    className?: string;
    items: {
        label: string;
        value: string;
        data?: T;
    }[];
    selected: {
        label: string;
        value: string;
    };
    onChange: (item: {
        label: string;
        value: string;
        data?: T;
    }) => void;
}
export declare function Selector<T = {}>(props: SelectorProps<T>): JSX.Element;
//# sourceMappingURL=selector.d.ts.map