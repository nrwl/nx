import { uriTransformer } from 'react-markdown';

export function transformImagePath(version: string): (src: string) => string {
  return (src) => {
    if (/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i.test(src)) {
      if (version === 'preview') {
        src = `/api/preview-asset?uri=${encodeURIComponent(src)}`;
      } else {
        src = `/documentation/${version}`.concat(src);
      }
    }
    return uriTransformer(src);
  };
}
