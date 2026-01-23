import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'truncate', standalone: true})
export class TruncatePipe implements PipeTransform
{
    transform(value: unknown, length?: unknown): string
    {
        const len = typeof length === 'number' ? length : 50;
        const str = String(value);
        return str.length > len ? str.slice(0, len) + '...' : str;
    }
}

@Pipe({name: 'capitalize', standalone: true})
export class CapitalizePipe implements PipeTransform
{
    transform(value: unknown): string
    {
        const str = String(value);
        return str.charAt(0)
            .toUpperCase() + str.slice(1)
            .toLowerCase();
    }
}
