# Architectural Plan: Unified API Docs Routing

## Problem Recap

- **Old:** API docs accessed via `/nx-api/[package]` and subroutes, handled by specialized Next.js router logic.
- **New:** Navigation via "Technologies" leads to URLs like `/technologies/angular/core/api`, which do not trigger the API docs UI.

## Goals

- **Consistency:** Same API docs experience regardless of navigation path.
- **Extensibility:** Flexible for new packages and menu changes.
- **Maintainability:** Minimize duplication, easy for future contributors.

## Proposed Solution

- **Unify API Doc Routing Logic:** Centralize API doc rendering so any API doc route triggers the same UI, regardless of path prefix.
- **Dynamic Route Matching:** Create a catch-all dynamic route (e.g., `pages/[[...apiPath]].tsx`) that analyzes the path and renders the correct UI.
- **Menu/Map-Driven Content Type Detection:** Enhance menu/map data to include a `contentType` or `renderWith` property for each entry, so the router can decide which UI to render.
- **Backwards Compatibility and Redirects:** Maintain `/nx-api/[package]` routes and add redirects as needed.
- **Subroute Handling:** Ensure subroutes like `/executors`, `/generators`, `/migrations` are handled correctly.

## Implementation Steps

1. Refactor API doc UI logic into a reusable component.
2. Create a catch-all dynamic route for both `/nx-api/[package]` and `/technologies/.../api`.
3. Update menu/map generation to include a `contentType` property for API doc entries.
4. Update the page component to parse the path, look up the menu/map entry, and render the correct UI.
5. Add redirects for legacy URLs if needed.
6. Test navigation via both "API Reference" and "Technologies".

## Example: Dynamic Route Handler (Pseudo-code)

```tsx
// pages/[[...slug]].tsx
export default function DocPage({ menu, ...props }) {
  const { asPath } = useRouter();
  const menuEntry = findMenuEntryForPath(menu, asPath);
  if (menuEntry?.contentType === 'api-doc') {
    return <ApiDocExplorer package={menuEntry.package} />;
  }
  // fallback: render markdown
  return <MarkdownDoc file={menuEntry.file} />;
}
```

## Summary Table

| Path Example                               | Content Type | Rendered UI       |
| ------------------------------------------ | ------------ | ----------------- |
| `/nx-api/angular`                          | api-doc      | API Explorer      |
| `/nx-api/angular/executors`                | api-doc      | API Explorer      |
| `/technologies/angular/core/api`           | api-doc      | API Explorer      |
| `/technologies/angular/angular-rspack/api` | api-doc      | API Explorer      |
| `/technologies/angular/core/recipes`       | markdown     | Markdown Renderer |

## Benefits

- Users always get the right UI, regardless of navigation path.
- Future menu changes are easier to support.
- No duplication of API doc logic.
- SEO and legacy links are preserved.
