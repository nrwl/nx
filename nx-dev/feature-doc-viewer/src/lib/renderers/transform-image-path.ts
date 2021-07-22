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
  const isVercel = !!process.env.VERCEL;
  const isPreview = version === 'preview';

  return (src) => {
    const isRelative = src.startsWith('.');

    if (!/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i.test(src)) {
      return uriTransformer(src);
    }

    if (!isVercel && isPreview) {
      return uriTransformer(
        `/api/preview-asset?uri=${encodeURIComponent(
          src
        )}&document=${encodeURIComponent(document.filePath)}`
      );
    }

    if (isRelative) {
      return uriTransformer(
        join(
          '/documentation',
          isPreview ? 'preview' : '',
          document.filePath,
          '..',
          src
        )
      );
    }

    return uriTransformer(`/documentation/${version}`.concat(src));
  };
}
