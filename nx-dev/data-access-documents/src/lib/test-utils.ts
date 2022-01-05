import { join } from 'path';
import { DocumentMetadata } from '@nrwl/nx-dev/data-access-documents';
import fs from 'fs';

function readJsonFile(f) {
  return JSON.parse(fs.readFileSync(f).toString());
}

export function createDocumentApiOptions() {
  return {
    documents: readJsonFile(
      join(
        join(__dirname, '../../../nx-dev/public/documentation'),
        'latest',
        'map.json'
      )
    ).find((x) => x.id === 'default') as DocumentMetadata,
    publicDocsRoot: join(__dirname, '../../../nx-dev/public/documentation'),
  };
}
