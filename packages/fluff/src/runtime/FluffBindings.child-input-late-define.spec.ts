import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestChildTasksListComponent } from './tests/TestChildTasksListComponent.js';
import { TestParentBindsTasksComponent } from './tests/TestParentBindsTasksComponent.js';

describe('bindings (child input late define)', () =>
{
    const tick = async(): Promise<void> =>
    {
        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });
    };

    const waitUntil = async(predicate: () => boolean, maxTicks: number, onTimeout: () => string): Promise<void> =>
    {
        for (let i = 0; i < maxTicks; i++)
        {
            if (predicate())
            {
                return;
            }
            await tick();
        }
        throw new Error(onTimeout());
    };

    beforeEach(() =>
    {
        FluffBase.__e = [
            (t: unknown): number[] =>
            {
                if (t instanceof TestParentBindsTasksComponent)
                {
                    return t.childList;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): number[] =>
            {
                if (t instanceof TestParentBindsTasksComponent)
                {
                    return t.tasksForChild;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): number[] =>
            {
                if (t instanceof TestChildTasksListComponent)
                {
                    return t.tasks;
                }
                throw new Error('Invalid type');
            }
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should render child for-loop items when parent binds tasks after child is defined', async() =>
    {
        TestParentBindsTasksComponent.__bindings = {
            l0: [{ n: 'tasks', b: 'property', e: 1 }]
        };

        if (!customElements.get('test-parent-binds-tasks'))
        {
            customElements.define('test-parent-binds-tasks', TestParentBindsTasksComponent);
        }

        const parent = document.createElement('test-parent-binds-tasks');
        if (!(parent instanceof TestParentBindsTasksComponent))
        {
            throw new Error('Expected TestParentBindsTasksComponent');
        }
        document.body.appendChild(parent);

        const childBeforeDefine = parent.shadowRoot?.querySelector('test-child-tasks-list');
        if (!(childBeforeDefine instanceof HTMLElement))
        {
            throw new Error('Expected HTMLElement child placeholder');
        }

        expect(childBeforeDefine.getAttribute('tasks'))
            .toBeNull();

        if (!customElements.get('test-child-tasks-list'))
        {
            customElements.define('test-child-tasks-list', TestChildTasksListComponent);
        }

        customElements.upgrade(childBeforeDefine);

        await Promise.resolve();

        await Promise.resolve();

        const child = parent.shadowRoot?.querySelector('test-child-tasks-list');
        if (!(child instanceof TestChildTasksListComponent))
        {
            throw new Error('Expected TestChildTasksListComponent');
        }

        expect(child.getAttribute('tasks'))
            .toBeNull();

        await waitUntil(() => child.tasks.length === 3, 50, () => `Timed out waiting for child.tasks to become 3. tasksAttr=${String(child.getAttribute('tasks'))} tasksLen=${String(child.tasks.length)}`);
        await waitUntil(() => (child.shadowRoot?.querySelectorAll('.item')?.length ?? 0) === 3, 50, () => `Timed out waiting for 3 rendered items. tasksAttr=${String(child.getAttribute('tasks'))} tasksLen=${String(child.tasks.length)} itemLen=${String(child.shadowRoot?.querySelectorAll('.item')?.length ?? 0)}`);

        expect(child.tasks.length)
            .toBe(3);

        const items = Array.from(child.shadowRoot?.querySelectorAll('.item') ?? []);
        expect(items.length)
            .toBe(3);

        parent.remove();
    });
});
