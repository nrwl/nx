import { TestPropertyBindingPipeChildComponent } from './TestPropertyBindingPipeChildComponent.js';

export function createChildComponent(): typeof TestPropertyBindingPipeChildComponent
{
    return class extends TestPropertyBindingPipeChildComponent
    {
    };
}
