export class MetadataArrayHelper
{
    public static getOrCreateArray<T>(ctor: object, metadataKey: string): T[]
    {
        const existing: unknown = Reflect.get(ctor, metadataKey);
        if (this.isTypedArray<T>(existing))
        {
            return existing;
        }
        const arr: T[] = [];
        Reflect.set(ctor, metadataKey, arr);
        return arr;
    }

    private static isTypedArray<T>(value: unknown): value is T[]
    {
        return Array.isArray(value);
    }
}
