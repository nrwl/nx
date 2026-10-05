# Goal: Nx Cloud Public API reference layout

**Issue:** DOC-696\
**Status:** Implementation preview complete. Source release and link styling remain separate follow-ups.\
**Repository:** `nrwl/nx`\
**Reference route:** `/docs/reference/nx-cloud/public-api`

## 1. Goal

Make the generated Public API reference easy to scan and use. Most readers need four things:

1. The endpoint and its HTTP method.
2. A description of what the endpoint does.
3. Its parameters.
4. The successful response body.

Make these the main reading path. Keep other HTTP responses accessible without repeating large tables or error descriptions for every endpoint.

Use the existing Astro content collection as the data source. Move the page layout into Astro templates and reuse Starlight components.

## 2. Current state

The reference already has:

- A dedicated `nx-cloud-public-api` content collection.
- A loader that fetches the deployed OpenAPI specification on each content sync.
- An Astro route wrapped in `StarlightPage`.
- Generated Markdown for the page, copy functionality, `.md` export, and the reference AI index.
- Shared HTTP response descriptions, response headers, and schema definitions.
- Collapsed success response bodies and examples.
- Readable schema names and authentication labels.
- Four Knowledge Base articles for practical API workflows.

The current Astro route still renders the whole page through `<Content />`. Most layout decisions remain in a function that builds Markdown strings.

An interim layout replaces endpoint response tables with linked codes below the route. It also removes operation IDs. The final layout below supersedes that interim arrangement: the successful status belongs beside the response body, and other codes belong after it.

## 3. Scope and limits

### In scope

- The generated reference and its presentation in `astro-docs/`.
- A structured model shared by the Astro page and Markdown export.
- Standard Starlight components and a small endpoint template.
- Existing sidebar navigation, search, section links, and the table of contents.
- Preservation of the current Knowledge Base links and articles.

### Out of scope

- Kotlin changes or other work in the `nrwl/ocean` worktree.
- API runtime behavior, authentication rules, rate limits, or route versions.
- A separate CI-feature overview page.
- A manually maintained OpenAPI document or endpoint catalogue.
- A new caching strategy or changes to the accepted build workflow.
- A Swagger UI, request playground, browser credential storage, or a separate React application.
- An exhaustive presentation test suite.

API descriptions, examples, constraints, and field meanings remain upstream in OpenAPI. The docs implementation controls presentation, not the API contract.

## 4. Required layout

### Endpoint with a JSON response

```text
Get a run
[GET] /nx-cloud/data/v1/runs/{runId}

<description from OpenAPI>

Parameters
<parameter table>

▸ Response body [200 OK]
    <JSON example>
    View field definitions

Other response codes: [400] [401] [403] [404] [409] [429] [503]
```

The brackets represent badges, not literal text.

- Show the endpoint title, method, path, and description first.
- Show the parameter table next.
- Put the successful status beside the response body control.
- Keep the response body collapsed initially.
- Do not make `200 OK` a separate link that jumps down the page.
- Show the JSON example inside the disclosure, with syntax highlighting and a copy button.
- Link to the shared field definitions from the response body.
- Put a compact row of other returned codes after the response body.
- Link those codes to the matching shared descriptions.
- Do not show operation IDs or per-endpoint response-code tables.

Use the statuses actually declared in OpenAPI. Do not assume that every endpoint returns `200`. Preserve additional declared success responses if the contract provides them.

If OpenAPI has no example, show the available schema information or field-definition link. Do not invent a JSON example. Preserve inline schemas and additional media types when present.

### Download endpoint

```text
Download a run-group workflow instance’s logs
[GET] /nx-cloud/data/v1/run-groups/{runGroupId}/steps/{stepId}/instances/{agentName}/assets/{type}

<description from OpenAPI>

Parameters
<parameter table>

[302 Found] Redirects to the asset’s download URL.

Other response codes: [400] [401] [403] [404] [409] [429] [503]
```

Show the redirect as the main successful outcome. Do not fabricate a JSON response body or a `200` status. Apply the same principle to responses without a body.

### Shared reference sections

Keep these sections on the same reference page:

1. Authentication.
2. Endpoint reference.
3. HTTP response codes and shared response headers.
4. Schema and field definitions.

Describe common error meanings and rate-limit headers once. Each endpoint must list only the other codes it actually declares.

Use status-keyed `components.responses` entries for common meanings when the response shape matches. Parameter, entity, or parent variations can share the common `400`, `404`, or `409` explanation. Do not restore a separate table for each variation.

Preserve genuinely different response bodies, headers, links, or meanings. A code link must select the correct variant. Keep a brief endpoint-specific note when a shared explanation is insufficient.

## 5. Starlight components

Reuse the installed Starlight components instead of creating new UI primitives:

| Need                     | Implementation                                |
| ------------------------ | --------------------------------------------- |
| Existing site layout     | `StarlightPage`                               |
| Method and status labels | `Badge`                                       |
| Linked secondary codes   | An ordinary `<a>` around `Badge`              |
| JSON examples            | `Code` from `@astrojs/starlight/components`   |
| Collapsed response body  | Native `<details>` and `<summary>`            |
| Section links            | `AnchorHeading` with explicit IDs             |
| Parameters and fields    | Standard tables with the existing site styles |

Use small badges and the existing light/dark theme. Keep secondary codes visually quiet. The primary success badge is a label, not a link.

Keep a single-column reading flow. Do not introduce cards, a card grid, or response-code tabs for this iteration. They add space and navigation without helping the main task.

The site already uses `Badge` and `Code`. Its installed Starlight version also provides `AnchorHeading`. No new UI dependency is needed.

## 6. Data and rendering architecture

```text
Deployed OpenAPI
       ↓
Existing loader: fetch and parse
       ↓
One normalized reference model
       ↓
Astro content-store entry
       ├── data.reference → Astro page and endpoint template
       └── body           → generated Markdown, copy, and AI exports
```

Build one normalized model from one fetched specification. Both output paths must use that model. Do not maintain separate endpoint facts for HTML and Markdown.

The model should contain only the information the reference needs:

- Provenance: source URL, API title, and API version.
- Overview prose and Knowledge Base navigation.
- Authentication methods and required credential combinations.
- Endpoint titles, methods, paths, descriptions, and parameters.
- Successful responses, examples, media types, and schema references.
- Other response codes and their shared-description targets.
- Shared response and header definitions, including meaningful variants.
- Shared schemas, field information, display labels, and reference targets.
- Heading records for navigation and the table of contents.

Keep the model serializable. Use arrays and plain objects rather than storing `Map`, `Set`, functions, or component instances.

### Model requirements

- Preserve path-level parameters and operation-level overrides.
- Preserve required fields, defaults, bounds, enums, formats, and nullability.
- Preserve array item types, dictionary value types, and inline-object information.
- Keep schema references as references. Do not recursively expand the entire schema graph.
- Preserve source descriptions and example values. Render rich OpenAPI prose as Markdown, not as unprocessed HTML.
- Use readable schema labels while retaining the raw `#schema-…` anchors. Apply those labels to both headings and type links.
- Derive labels from schema titles or generic naming rules. Detect pagination from its structure, not a list of hard-coded schema names.
- Keep raw generated names such as `PageResponse_RunGroupListResponse` out of visible headings.
- Use a source summary or readable label for multiple examples. Preserve their descriptions. Use “Example response” for a single response example.
- Preserve request-body information when a future specification declares it.

Build IDs and link targets in the model. Reuse existing schema and endpoint anchors where possible. Any necessary anchor change must be deliberate, not an accidental result of a new template.

## 7. Implementation steps

### Step 1: Separate the model from the Markdown renderer

**Primary file:** `astro-docs/src/plugins/utils/openapi-reference.ts`

- Extract a model builder from the current combined parsing and presentation code.
- Reuse the existing reference resolution, schema-label, parameter, response, and header logic.
- Keep response grouping independent of either output format.
- Change Markdown generation to consume the model rather than interpret OpenAPI again.
- Keep all display labels, status targets, and heading IDs consistent between outputs.

### Step 2: Store the model in the existing collection

**Files:**

- `astro-docs/src/plugins/nx-cloud-public-api.loader.ts`
- `astro-docs/src/content.config.ts`

- Add a typed `reference` field to the collection data with the existing schema’s `.extend()` pattern.
- Fetch once per content sync, then build the model and Markdown from that same specification.
- Keep the entry ID `reference` and slug `reference/nx-cloud/public-api`.
- Include the model and Markdown in the entry digest.
- Keep the default source: https://cloud.nx.app/nx-cloud/data/openapi.json
- Preserve `NX_CLOUD_OPENAPI_URL` and the 30-second fetch timeout.
- Fail the sync if the source cannot be fetched or parsed. Do not publish a stale fallback.
- Do not add unused metadata or another fetch path in the page template.

Pre-render Markdown prose fragments during content loading if the Astro template needs HTML. Do not retain a full duplicate HTML document solely to obtain heading metadata.

### Step 3: Render the reference in Astro

**Existing page:** `astro-docs/src/pages/reference/nx-cloud/public-api.astro`\
**Suggested new component:** `astro-docs/src/components/public-api/ApiEndpoint.astro`

- Read the structured model from the collection entry.
- Replace the full-page `<Content />` rendering with the planned Astro layout.
- Use one endpoint component for repeated endpoint sections.
- Use the standard Starlight components listed above.
- Render authentication, shared responses, headers, and schemas from the same model.
- Render explicit heading IDs and pass matching `{ depth, slug, text }` records to `StarlightPage`.
- Preserve the sidebar entry and the site’s reference search classification.
- Keep the page prerendered so Pagefind can index its HTML.

### Step 4: Preserve copy and machine-readable exports

**Relevant files:**

- `astro-docs/src/pages/[...slug].md.ts`
- `astro-docs/src/utils/llms.ts`
- The existing copy-content middleware and page integration.

- Keep `/docs/reference/nx-cloud/public-api.md` available.
- Keep the reference in `/docs/reference/llms.txt`.
- Continue supplying `Astro.locals.rawContent` for the copy feature.
- Include the source URL, API version, and relevant navigation in the exported reference, not only the HTML wrapper.
- Use ordinary Markdown for the export. Do not expose Astro component tags.
- Check that badges, collapsed examples, and links have readable Markdown equivalents.

### Step 5: Keep authentication language explicit

The main requirement is:

> Use a CI access token, or use both a personal access token (PAT) and the Nx Cloud Id.

Keep the method titles:

- `CiAccessToken`
- `PersonalAccessToken`
- `NxCloudId`

Use upstream `x-displayName` values. Do not rename the underlying security-scheme keys or HTTP headers.

Preserve these source descriptions:

- A PAT can be generated in Nx Cloud profile settings or with `nx login`.
- A CI access token is available in the workspace’s access control settings.
- The NxCloudId description starts with “The Nx Cloud Id, also known as a workspace Id.” It identifies `nx.json` → `nxCloudId`, or the workspace’s general settings → “Workspace ID”, as the discovery paths.
- PAT authentication requires both `Nx-Cloud-Personal-Access-Token` and `Nx-Cloud-Id`.

Do not describe the human term “workspace Id” as an alias of the code identifier `workspaceId`.

These are upstream documentation facts. Coordinate missing or incorrect source metadata with the API owner instead of adding frontend overrides.

### Step 6: Update project guidance

Update `astro-docs/README.md` to explain the model/template split, retained exports, and source override. Keep the current fetching and build-caching behavior unchanged.

Preserve the four existing Knowledge Base articles:

- `astro-docs/src/content/docs/kb/query-public-api.mdoc`
- `astro-docs/src/content/docs/kb/investigate-flaky-tasks-with-api.mdoc`
- `astro-docs/src/content/docs/kb/debug-ci-failures-with-api.mdoc`
- `astro-docs/src/content/docs/kb/analyze-task-distribution-with-api.mdoc`

### Step 7: Coordinate the source and release

The production docs build consumes the deployed specification. Local Kotlin documentation changes do not appear there automatically.

- Confirm that the intended deployment contains the required descriptions, examples, and display names.
- Use `NX_CLOUD_OPENAPI_URL` for a local preview or another approved deployment.
- Do not rewrite beta routes as v1 routes in the docs. Display the contract returned by the selected source.
- Keep the API release/version transition and Kotlin work separate from this docs implementation.

## 8. Completion criteria

- [ ] The existing reference route renders through Astro templates inside `StarlightPage`.
- [ ] One model supplies both the HTML page and Markdown export.
- [ ] Each endpoint follows title → method/path → description → parameters → successful response.
- [ ] Successful status labels sit beside the response body or redirect outcome, without jump links.
- [ ] Response bodies start collapsed and open through their summary controls.
- [ ] JSON examples support syntax highlighting and copy.
- [ ] Other declared codes appear as compact links after the primary response.
- [ ] Common code meanings and rate-limit headers appear once.
- [ ] Meaningfully different response variants remain accessible through the correct links.
- [ ] Operation IDs and per-endpoint response-code tables do not appear.
- [ ] Download endpoints describe their declared redirect without a fabricated body.
- [ ] Schema and section links resolve to the correct targets.
- [ ] Authentication names and required credential combinations remain clear and accurate.
- [ ] Sidebar navigation, search, the table of contents, and Knowledge Base links remain available.
- [ ] The copy feature, `.md` export, and reference AI index remain available.
- [ ] API source failures still fail content sync rather than publish a fallback.
- [ ] No Kotlin files, API runtime rules, or unrelated worktree changes are included.

## 9. Verification and handoff

Keep the existing small test scope: three loader checks and one browser smoke test. Update those tests for the model/template split rather than restoring detailed assertions for every heading, label, or response code.

The browser smoke check should cover the rendered reference, schema links, a collapsed response body, and the Markdown export. The loader checks should cover content refresh and failed source/data handling.

Review a JSON endpoint and a redirect endpoint at desktop and narrow widths. Check keyboard access to disclosures and code links. Check light and dark themes.

No validation run is requested as part of preparing this plan. For follow-up execution, agree when to run checks with the owner. A preview build can refresh the page without running the full test suite.

Example preview build with the existing local API server:

```bash
NX_CLOUD_OPENAPI_URL=http://127.0.0.1:4203/nx-cloud/data/openapi.json \
  mise exec -- pnpm exec nx build astro-docs --excludeTaskDependencies
```

When checks are requested, use the existing Nx targets:

```bash
mise exec -- pnpm exec nx run astro-docs:lint --excludeTaskDependencies
mise exec -- pnpm exec nx run astro-docs:validate-links --excludeTaskDependencies
mise exec -- pnpm exec nx prepush
```

The local URLs assume that the API server and docs preview are already available. A clean checkout can also need the normal package build dependencies. Repository submission checks remain separate from the manual preview review.

For handoff, provide the source URL and API version used for the preview, screenshots of the JSON and redirect layouts, and any remaining upstream documentation gaps.

## 10. Reference material

Starlight supports the required layout primitives:

- Custom pages and `StarlightPage`: https://starlight.astro.build/guides/pages/
- Badges: https://starlight.astro.build/components/badges/
- Code examples: https://starlight.astro.build/components/code/
- Native disclosures: https://starlight.astro.build/guides/authoring-content/#details
- Component usage: https://starlight.astro.build/components/using-components/
- Astro loader data and body: https://docs.astro.build/en/reference/content-loader-reference/

The design combines familiar documentation patterns rather than copying a complete external layout:

- GitHub documents response codes beside individual endpoints: https://docs.github.com/en/rest/repos/repos#get-a-repository
- Stripe provides shared HTTP-code explanations: https://docs.stripe.com/api/errors

The Nx reference should use shared explanations like Stripe, while keeping the successful endpoint response as the main content.
