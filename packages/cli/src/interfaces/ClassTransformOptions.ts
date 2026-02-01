export interface ClassTransformOptions
{
    className: string;
    originalSuperClass?: string;
    newSuperClass?: string;
    injectMethods?: {
        name: string; body: string;
    }[];
}
