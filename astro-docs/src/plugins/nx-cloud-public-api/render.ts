import {
  anchor,
  code,
  fencedCode,
  headingMarkdown,
  tableMarkdown,
} from './formatting';
import type {
  OpenApiReference,
  ReferenceHeading,
  ReferenceMedia,
  ReferenceProse,
  ReferenceResponse,
} from './types';

export function referenceHeadings(
  reference: OpenApiReference
): ReferenceHeading[] {
  const { sections, endpoints, responses, headers, schemas, servers } =
    reference;
  return [
    ...reference.navigation.map((group) => group.heading),
    ...(servers.length ? [sections.servers] : []),
    sections.endpoints,
    ...endpoints.map((item) => item.heading),
    sections.responses,
    ...responses.map((item) => item.heading),
    ...(headers.length
      ? [sections.headers, ...headers.map((item) => item.heading)]
      : []),
    sections.schemas,
    ...schemas.map((item) => item.heading),
  ];
}

/** Render only prose fragments. Do not store a second full HTML reference. */
export async function renderReferenceProse(
  reference: OpenApiReference,
  render: (markdown: string) => Promise<{ html: string }>
): Promise<void> {
  const cache = new Map<string, Promise<string>>();
  const visit = async (value: unknown): Promise<void> => {
    if (!value || typeof value !== 'object') return;
    if ('markdown' in value && 'html' in value) {
      const fragment = value as ReferenceProse;
      if (!cache.has(fragment.markdown))
        cache.set(
          fragment.markdown,
          fragment.markdown
            ? render(fragment.markdown).then((result) => result.html)
            : Promise.resolve('')
        );
      fragment.html = await cache.get(fragment.markdown)!;
      return;
    }
    await Promise.all(Object.values(value).map(visit));
  };
  await visit(reference);
}

function contentMarkdown(content: ReferenceMedia[]): string {
  return content
    .map((media) =>
      [
        media.mediaType ? `Content type: ${code(media.mediaType)}.` : '',
        media.schema.markdown,
        media.description.markdown,
        tableMarkdown(media.fields),
        ...media.examples.flatMap((example) => [
          `**${example.label}**`,
          example.description.markdown,
          ...(example.code !== undefined
            ? [fencedCode(example.code, example.language)]
            : []),
          ...(example.url ? [`Example URL: ${example.url}`] : []),
        ]),
        media.fieldTarget
          ? `[View field definitions](#${media.fieldTarget})`
          : '',
        media.definition
          ? `<details>\n<summary>Schema definition</summary>\n\n${fencedCode(media.definition)}\n\n</details>`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    )
    .join('\n\n');
}

function responseDetailsMarkdown(
  response: ReferenceResponse,
  description = true
): string {
  return [
    description ? response.description.markdown : '',
    contentMarkdown(response.content),
    response.headers.length
      ? `Response headers: ${response.headers.map(({ name, target }) => `[${code(name)}](#${target})`).join(', ')}.`
      : '',
    response.links ? `Response links:\n\n${fencedCode(response.links)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The export uses the same facts, labels, and link targets as the Astro templates. */
export function renderOpenApiReference(reference: OpenApiReference): string {
  const lines = [
    reference.introduction.markdown,
    reference.description.markdown,
    `API: ${reference.title}. API version: ${code(reference.version)}.`,
    `Specification source: ${code(reference.sourceUrl)}.`,
    ...reference.navigation.flatMap((group) => [
      headingMarkdown(group.heading),
      group.links
        .map(
          ({ label, href, id }) =>
            `- ${id ? anchor(id) : ''}[${label}](${href})`
        )
        .join('\n'),
    ]),
    ...(reference.servers.length
      ? [
          headingMarkdown(reference.sections.servers),
          ...reference.servers.map((server) => `- ${server.markdown}`),
        ]
      : []),
  ];
  lines.push(headingMarkdown(reference.sections.endpoints));
  for (const endpoint of reference.endpoints) {
    lines.push(
      headingMarkdown(endpoint.heading),
      `${code(endpoint.method)} ${code(endpoint.path)}`,
      endpoint.description.markdown
    );
    if (endpoint.deprecated) lines.push('**Deprecated operation.**');
    if (endpoint.authentication)
      lines.push('**Authentication**', endpoint.authentication.markdown);
    if (endpoint.parameters.rows.length)
      lines.push('**Parameters**', tableMarkdown(endpoint.parameters));
    for (const parameter of endpoint.parameterDetails)
      lines.push(
        `**Parameter: ${code(parameter.name)}**`,
        contentMarkdown(parameter.content)
      );
    if (endpoint.requestBody)
      lines.push(
        '**Request body**',
        endpoint.requestBody.required ? 'Required.' : 'Optional.',
        endpoint.requestBody.description.markdown,
        contentMarkdown(endpoint.requestBody.content)
      );
    for (const response of endpoint.successes) {
      const details = responseDetailsMarkdown(response);
      lines.push(
        response.content.length
          ? `<details id="${response.id}">\n<summary>Response body — ${response.label}</summary>\n\n${details}\n\n</details>`
          : `${anchor(response.id)}\n\n**${response.label}**\n\n${details}`
      );
    }
    if (endpoint.otherResponses.length)
      lines.push(
        `Other response codes: ${endpoint.otherResponses.map(({ status, target, label }) => `[${code(status)}](#${target} "${label}")`).join(' • ')}`
      );
  }
  lines.push(headingMarkdown(reference.sections.responses));
  for (const group of reference.responses) {
    lines.push(headingMarkdown(group.heading));
    for (const definition of group.definitions) {
      for (const { ids, description } of definition.descriptions)
        lines.push(ids.map(anchor).join('\n'), description.markdown);
      lines.push(responseDetailsMarkdown(definition.response, false));
    }
  }
  if (reference.headers.length) {
    lines.push(headingMarkdown(reference.sections.headers));
    for (const header of reference.headers)
      lines.push(
        headingMarkdown(header.heading),
        header.description.markdown,
        header.schema.markdown,
        tableMarkdown(header.fields),
        contentMarkdown(header.content),
        `Documented with HTTP ${header.statuses.map(code).join(', ')}.`
      );
  }
  lines.push(headingMarkdown(reference.sections.schemas));
  for (const schema of reference.schemas)
    lines.push(
      headingMarkdown(schema.heading),
      schema.description.markdown,
      schema.type.markdown,
      tableMarkdown(schema.fields),
      `<details>\n<summary>Schema definition</summary>\n\n${fencedCode(schema.definition)}\n\n</details>`
    );
  return lines.filter(Boolean).join('\n\n');
}
