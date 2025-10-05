import { uriTransformer } from './uri-transformer';

export function transformImagePath(
  documentFilePath: string
): (src: string) => string {
  return (src) => {
    const isRelative = src.startsWith('.');

    if (!/\.(gif|jpe?g|tiff?|png|webp|bmp|svg|avif)$/i.test(src)) {
      return uriTransformer(src);
    }

    if (isRelative) {
      return uriTransformer(
        new URL(
          [
            'http://example.com',
            documentFilePath.split('/').splice(3).join('/'),
            '..',
            src,
          ].join('/')
        ).pathname
      );
    }

    return uriTransformer(`/documentation`.concat(src));
  };
}
