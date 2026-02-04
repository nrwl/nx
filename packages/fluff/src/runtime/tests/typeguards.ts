import type { TestLateDefineForColumn } from './TestLateDefineForComponent.js';
import type { TestTask } from './TestNullInputTextComponent.js';

export function hasItem(t: unknown): t is { item: unknown }
{
    return t !== null && typeof t === 'object' && 'item' in t;
}

export function hasItemName(t: unknown): t is { itemName: string }
{
    return t !== null && typeof t === 'object' && 'itemName' in t && typeof (t as {
        itemName: unknown
    }).itemName === 'string';
}

export function hasTask(t: unknown): t is { task: TestTask }
{
    return t !== null && typeof t === 'object' && 'task' in t;
}

export function isLateDefineForColumn(l: unknown): l is { column: TestLateDefineForColumn }
{
    return l !== null && typeof l === 'object' && 'column' in l;
}

export function hasValue(t: unknown): t is { value: string }
{
    return t !== null && typeof t === 'object' && 'value' in t && typeof (t as { value: unknown }).value === 'string';
}

export function hasTaskId(e: unknown): e is { taskId: number }
{
    return e !== null && typeof e === 'object' && 'taskId' in e && typeof (e as {
        taskId: unknown
    }).taskId === 'number';
}
