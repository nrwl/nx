import {
  getSchemaFromReference,
  InternalLookup,
  Lookup,
} from '@nx/nx-dev/data-access-packages';
import {
  JsonSchema,
  NxSchema,
  ProcessedPackageMetadata,
  SchemaMetadata,
} from '@nx/nx-dev/models-package';
import { ParsedUrlQuery } from 'querystring';
import { Errors, Example, generateJsonExampleFor } from './examples';
import { pkgToGeneratedApiDocs } from '@nx/nx-dev/models-document';

function getReferenceFromQuery(query: string): string {
  return query.replace('root/', '#/');
}

export interface SchemaViewModel {
  currentSchema: NxSchema | null;
  currentSchemaExamples: Example | Errors;
  deprecated: string;
  hidden: boolean;
  lookup: Lookup;
  packageName: string;
  packageUrl: string;
  rootReference: string;
  schemaGithubUrl: string;
  schemaMetadata: SchemaMetadata;
  subReference: string;
  type: 'executor' | 'generator' | 'migration';
}

export function getSchemaViewModel(
  routerQuery: ParsedUrlQuery,
  pkg: ProcessedPackageMetadata,
  schema: SchemaMetadata
): SchemaViewModel | null {
  if (!schema.schema) return null;
  const packageUrl = pkgToGeneratedApiDocs[pkg.name].pagePath;

  return {
    schemaMetadata: schema,
    packageName: pkg.packageName,
    packageUrl,
    schemaGithubUrl: pkg.githubRoot + schema.path,
    rootReference: '#',
    subReference:
      Object.prototype.hasOwnProperty.call(routerQuery, 'ref') &&
      !Array.isArray(routerQuery['ref'])
        ? getReferenceFromQuery(String(routerQuery['ref']))
        : '',
    lookup: new InternalLookup(schema.schema as JsonSchema),
    get currentSchema(): NxSchema | null {
      return (
        (getSchemaFromReference(this.rootReference, this.lookup) as NxSchema) ??
        null
      );
    },
    get currentSchemaExamples(): Example | Errors {
      return generateJsonExampleFor(
        this.schemaMetadata.schema as JsonSchema,
        this.lookup,
        'both'
      );
    },
    hidden: schema.hidden,
    deprecated: schema['x-deprecated'] || '',
    type: schema.type,
  };
}
