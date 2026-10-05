import { createHash } from 'node:crypto';
import {
  fetchOpenApiSpecificationText,
  openApiSpecificationUrl,
} from '../src/plugins/nx-cloud-public-api/fetch-specification.mjs';

const content = await fetchOpenApiSpecificationText(openApiSpecificationUrl());
console.log(createHash('sha256').update(content).digest('hex'));
