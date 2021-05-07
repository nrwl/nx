import { uriTransformer } from 'react-markdown';

export function transformImagePath(version: string): (src: string) => string {
  return (src) => {
    if (/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i.test(src)) {
      src = `/${version}`.concat(src); // TODO: copy imgs into public folder, by version id
    }
    return uriTransformer(src);
  };
}
