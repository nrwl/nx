export class ErrorHelpers
{
    public static getErrorMessage(e: unknown): string
    {
        return e instanceof Error ? e.message : String(e);
    }

    public static toError(e: unknown): Error
    {
        return e instanceof Error ? e : new Error(String(e));
    }
}
