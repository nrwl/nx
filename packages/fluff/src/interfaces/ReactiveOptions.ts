import type { Direction } from '../enums/Direction.js';

export interface ReactiveOptions
{
    alias?: string;
    direction?: Direction;
    commitTrigger?: string;
}
