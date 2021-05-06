import { basename } from 'path';
import { visitNotIgnoredFiles, readJsonInTree } from '@nrwl/workspace';

export default function () {
  return visitNotIgnoredFiles((file, host) => {
    if (basename(file) === 'schema.json') {
      const p = readJsonInTree(host as any, file);
      if (
        p.$schema === 'https://json-schema.org/draft-07/schema' ||
        p.$schema === 'http://json-schema.org/draft-07/schema'
      ) {
        p.$schema = 'http://json-schema.org/schema';
        delete p.$id;
      }
      host.overwrite(file, JSON.stringify(p, null, 2));
    }
  });
}
