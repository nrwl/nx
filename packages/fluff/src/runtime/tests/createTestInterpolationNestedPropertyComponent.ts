import { TestInterpolationNestedPropertyComponentBase } from './TestInterpolationNestedPropertyComponentBase.js';

export function createTestInterpolationNestedPropertyComponent(): new () => TestInterpolationNestedPropertyComponentBase
{
    return class extends TestInterpolationNestedPropertyComponentBase
    {
    };
}
