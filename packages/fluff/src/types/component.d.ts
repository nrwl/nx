import type { Subscription } from '../interfaces/Subscription';

declare global
{
    interface HTMLElement
    {
        $watch: (properties: string[], callback: () => void) => Subscription;
    }
}

export {};
