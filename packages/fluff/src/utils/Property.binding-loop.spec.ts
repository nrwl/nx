import { describe, expect, it, vi } from 'vitest';
import { Property } from './Property.js';

describe('Property (binding loop)', () =>
{
    it('should log an error including propertyName when a binding loop occurs', async() =>
    {
        const errorSpy = vi.spyOn(console, 'error')
            .mockImplementation(() =>
            {
            });

        try
        {
            const a = new Property<number>({ initialValue: 0, propertyName: 'a' });
            const b = new Property<number>({ initialValue: 0, propertyName: 'b' });

            a.onChange.subscribe((v: number): void =>
            {
                b.setValue(v + 1);
            });

            b.onChange.subscribe((v: number): void =>
            {
                a.setValue(v + 1);
            });

            a.setValue(1);

            await Promise.resolve();
            await Promise.resolve();

            const calls = errorSpy.mock.calls
                .map(args => args.map(String)
                    .join(' '));

            const loopErrors = calls.filter(m => m.includes('Binding loop detected'));
            expect(loopErrors.length)
                .toBeGreaterThan(0);

            expect(loopErrors.some(m => m.startsWith('a: ')))
                .toBe(true);
        }
        finally
        {
            errorSpy.mockRestore();
        }
    });
});
