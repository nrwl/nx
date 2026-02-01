export interface HtmlTransformOptions
{
    jsBundle: string;
    cssBundle?: string;
    inlineStyles?: string;
    gzip?: boolean;
    minify?: boolean;
    liveReload?: boolean;
}
