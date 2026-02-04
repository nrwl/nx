import type { Subscription } from '../interfaces/Subscription';

declare global
{
    interface HTMLElement
    {
        $watch: (properties: string[], callback: (changed: string) => void) => Subscription;
    }
}

export {};
