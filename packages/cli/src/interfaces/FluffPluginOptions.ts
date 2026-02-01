export interface FluffPluginOptions
{
    srcDir: string;
    outDir?: string;
    minify?: boolean;
    sourcemap?: boolean;
    skipDefine?: boolean;
    production?: boolean;
}
