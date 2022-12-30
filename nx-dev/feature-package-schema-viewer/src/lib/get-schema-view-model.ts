import {
  getSchemaFromReference,
  InternalLookup,
  Lookup,
} from '@nrwl/nx-dev/data-access-packages';
import {
  JsonSchema,
  NxSchema,
  ProcessedPackageMetadata,
  SchemaMetadata,
} from '@nrwl/nx-dev/models-package';
import { ParsedUrlQuery } from 'querystring';
import { Errors, Example, generateJsonExampleFor } from './examples';

function getReferenceFromQuery(query: string): string {
  return query.replace('root/', '#/');
}

export interface SchemaViewModel {
  currentSchema: NxSchema | null;
  currentSchemaExamples: Example | Errors;
  hidden: boolean;
  lookup: Lookup;
  packageName: string;
  packageUrl: string;
  rootReference: string;
  schemaGithubUrl: string;
  schemaMetadata: SchemaMetadata;
  subReference: string;
  type: 'executor' | 'generator';
}

export function getSchemaViewModel(
  routerQuery: ParsedUrlQuery,
  pkg: ProcessedPackageMetadata,
  schema: SchemaMetadata
): SchemaViewModel | null {
  if (!schema.schema) return null;

  return {
    schemaMetadata: schema,
    packageName: pkg.packageName,
    packageUrl: `/packages/${pkg.name}`,
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
    type: schema.type,
  };
}
