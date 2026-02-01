export interface BundleOptions
{
    minify?: boolean;
    splitting?: boolean;
    target?: string;
    gzip?: boolean;
    gzScriptTag?: boolean;
    external?: string[];
}
