import { join } from 'path';
import { uriTransformer } from 'react-markdown';

export function transformImagePath(
  documentFilePath: string
): (src: string) => string {
  return (src) => {
    const isRelative = src.startsWith('.');

    if (!/\.(gif|jpe?g|tiff?|png|webp|bmp|svg)$/i.test(src)) {
      return uriTransformer(src);
    }

    if (isRelative) {
      return uriTransformer(
        join('/', documentFilePath.split('/').splice(3).join('/'), '..', src)
      );
    }

    return uriTransformer(`/documentation`.concat(src));
  };
}
