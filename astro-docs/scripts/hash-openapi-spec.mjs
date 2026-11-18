import { createHash } from 'node:crypto';
import {
  fetchOpenApiSpecificationJson,
  openApiSpecificationUrl,
} from '../src/plugins/nx-cloud-public-api/fetch-specification.mjs';

const specification = await fetchOpenApiSpecificationJson(
  openApiSpecificationUrl()
);
console.log(
  createHash('sha256').update(JSON.stringify(specification)).digest('hex')
);
