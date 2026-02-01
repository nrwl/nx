export interface ImportTransformOptions
{
    removeImportsFrom?: string[];
    removeDecorators?: string[];
    pathReplacements?: Record<string, string>;
    addJsExtension?: boolean;
}
