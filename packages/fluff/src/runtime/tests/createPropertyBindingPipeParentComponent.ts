import { TestPropertyBindingPipeParentComponent } from './TestPropertyBindingPipeParentComponent.js';

export function createParentComponent(): typeof TestPropertyBindingPipeParentComponent
{
    return class extends TestPropertyBindingPipeParentComponent
    {
    };
}
