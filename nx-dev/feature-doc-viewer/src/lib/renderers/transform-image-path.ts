import { uriTransformer } from 'react-markdown';
import { DocumentData } from '@nrwl/nx-dev/data-access-documents';
import { join } from 'path';

export function transformImagePath({
  version,
  document,
}: {
  version: string;
  document: DocumentData;
}): (src: string) => string {
  return (src) => {
    if (/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i.test(src)) {
      if (version === 'preview') {
        src = `/api/preview-asset?uri=${encodeURIComponent(
          src
        )}&document=${encodeURIComponent(document.filePath)}`;
      } else {
        if (src.startsWith('.')) {
          src = join('/documentation', document.filePath, '..', src);
        } else {
          src = `/documentation/${version}`.concat(src);
        }
      }
    }
    return uriTransformer(src);
  };
}
