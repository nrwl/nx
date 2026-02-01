export interface BundleOptions
{
    minify?: boolean;
    splitting?: boolean;
    target?: string;
    gzip?: boolean;
    external?: string[];
}
