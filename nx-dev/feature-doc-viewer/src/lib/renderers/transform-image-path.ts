import { uriTransformer } from 'react-markdown';
import {
  DocumentData,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { join } from 'path';

export function transformImagePath({
  version,
  document,
}: {
  version: VersionMetadata;
  document: DocumentData;
}): (src: string) => string {
  return (src) => {
    const isRelative = src.startsWith('.');

    if (!/\.(gif|jpe?g|tiff?|png|webp|bmp|svg)$/i.test(src)) {
      return uriTransformer(src);
    }

    if (isRelative) {
      return uriTransformer(
        join('/', document.filePath.split('/').splice(3).join('/'), '..', src)
      );
    }

    return uriTransformer(`/documentation/${version.id}`.concat(src));
  };
}
