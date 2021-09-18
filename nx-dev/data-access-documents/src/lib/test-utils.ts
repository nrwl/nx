import { join } from 'path';
import { DocumentMetadata } from '@nrwl/nx-dev/data-access-documents';
import fs from 'fs';

function readJsonFile(f) {
  return JSON.parse(fs.readFileSync(f).toString());
}

export function createDocumentApiOptions() {
  return {
    versions: readJsonFile(
      join(
        join(__dirname, '../../../nx-dev/public/documentation'),
        'versions.json'
      )
    ),
    flavors: readJsonFile(
      join(
        join(__dirname, '../../../nx-dev/public/documentation'),
        'flavors.json'
      )
    ),
    documentsMap: new Map<string, DocumentMetadata[]>([
      [
        'latest',
        readJsonFile(
          join(
            join(__dirname, '../../../nx-dev/public/documentation'),
            'latest',
            'map.json'
          )
        ),
      ],
      [
        'previous',
        readJsonFile(
          join(
            join(__dirname, '../../../nx-dev/public/documentation'),
            'previous',
            'map.json'
          )
        ),
      ],
    ]),
    publicDocsRoot: join(__dirname, '../../../nx-dev/public/documentation'),
  };
}
