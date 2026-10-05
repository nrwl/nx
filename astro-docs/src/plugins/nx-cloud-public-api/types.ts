/** Markdown is the source for rich prose; the loader renders each fragment once. */
export interface ReferenceProse {
  markdown: string;
  html: string;
}

export interface ReferenceTable {
  columns: string[];
  rows: { id?: string; required: boolean; cells: ReferenceProse[] }[];
}

export interface ReferenceHeading {
  depth: 2 | 3 | 4;
  slug: string;
  text: string;
}

export interface ReferenceExample {
  label: string;
  description: ReferenceProse;
  code?: string;
  language: string;
  url?: string;
}

export interface ReferenceMedia {
  mediaType: string;
  schema: ReferenceProse;
  description: ReferenceProse;
  fields: ReferenceTable;
  definition?: string;
  fieldTarget?: string;
  examples: ReferenceExample[];
}

export interface ReferenceResponse {
  id: string;
  label: string;
  description: ReferenceProse;
  content: ReferenceMedia[];
  headers: { name: string; target: string }[];
  links?: string;
}

export interface ReferenceEndpoint {
  heading: ReferenceHeading;
  method: string;
  path: string;
  description: ReferenceProse;
  deprecated: boolean;
  authentication?: ReferenceProse;
  parameters: ReferenceTable;
  parameterDetails: { name: string; content: ReferenceMedia[] }[];
  requestBody?: {
    required: boolean;
    description: ReferenceProse;
    content: ReferenceMedia[];
  };
  successes: ReferenceResponse[];
  otherResponses: { status: string; label: string; target: string }[];
}

export interface OpenApiReference {
  sourceUrl: string;
  title: string;
  version: string;
  introduction: ReferenceProse;
  description: ReferenceProse;
  navigation: {
    heading: ReferenceHeading;
    links: { label: string; href: string; id?: string }[];
  }[];
  servers: ReferenceProse[];
  sections: {
    servers: ReferenceHeading;
    endpoints: ReferenceHeading;
    responses: ReferenceHeading;
    headers: ReferenceHeading;
    schemas: ReferenceHeading;
  };
  endpoints: ReferenceEndpoint[];
  responses: {
    heading: ReferenceHeading;
    definitions: {
      response: ReferenceResponse;
      descriptions: { ids: string[]; description: ReferenceProse }[];
    }[];
  }[];
  headers: {
    heading: ReferenceHeading;
    definitions: {
      schema: ReferenceProse;
      fields: ReferenceTable;
      content: ReferenceMedia[];
      descriptions: {
        id: string;
        description: ReferenceProse;
        statuses: string[];
      }[];
    }[];
  }[];
  schemas: {
    heading: ReferenceHeading;
    description: ReferenceProse;
    type: ReferenceProse;
    fields: ReferenceTable;
    definition: string;
  }[];
}

export type OpenApiObject = Record<string, unknown>;

export interface OpenApiDocument extends OpenApiObject {
  openapi: string;
  info: OpenApiObject & { title: string; version: string };
  paths: Record<string, OpenApiObject>;
}
