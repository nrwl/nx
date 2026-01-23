import type { PipeTransform } from '@fluffjs/fluff';
import { Pipe } from '@fluffjs/fluff';

@Pipe('uppercase')
export class UppercasePipe implements PipeTransform<[], string>
{
    public transform(value: unknown): string
    {
        return String(value)
            .toUpperCase();
    }
}

@Pipe('lowercase')
export class LowercasePipe implements PipeTransform<[], string>
{
    public transform(value: unknown): string
    {
        return String(value)
            .toLowerCase();
    }
}

@Pipe('truncate')
export class TruncatePipe implements PipeTransform<[unknown?], string>
{
    public transform(value: unknown, length?: unknown): string
    {
        const len = typeof length === 'number' ? length : 50;
        const str = String(value);
        return str.length > len ? str.slice(0, len) + '...' : str;
    }
}

@Pipe('capitalize')
export class CapitalizePipe implements PipeTransform<[], string>
{
    public transform(value: unknown): string
    {
        const str = String(value);
        return str.charAt(0)
            .toUpperCase() + str.slice(1)
            .toLowerCase();
    }
}

@Pipe('date')
export class DatePipe implements PipeTransform<[unknown?], string>
{
    public transform(value: unknown, format?: unknown): string
    {
        if (!value) return '';
        if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return '';
        const d = new Date(value);
        const fmt = typeof format === 'string' ? format : 'short';
        if (fmt === 'short') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (fmt === 'long') return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        return d.toLocaleDateString();
    }
}
