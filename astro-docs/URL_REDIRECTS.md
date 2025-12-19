# URL Redirects Tracking

This file tracks URL changes that need redirects configured in the deployment platform (Netlify).

## Learn Nx Reorganization (DOC-365)

Date: 2024-12-19

### Redirects Required

| Old URL                                                | New URL                                            | Status  |
| ------------------------------------------------------ | -------------------------------------------------- | ------- |
| `/docs/getting-started/installation`                   | `/docs/getting-started/start-new-project`          | Pending |
| `/docs/getting-started/editor-setup`                   | `/docs/getting-started/local-development`          | Pending |
| `/docs/getting-started/ai-setup`                       | `/docs/getting-started/local-development`          | Pending |
| `/docs/getting-started/nx-cloud`                       | `/docs/guides/nx-cloud/intro`                      | Pending |
| `/docs/guides/installation/install-non-javascript`     | `/docs/reference/install-non-javascript`           | Pending |
| `/docs/guides/installation/update-global-installation` | `/docs/troubleshooting/update-global-installation` | Pending |

### Notes

- All redirects should be 301 (permanent) redirects
- Configure in `netlify.toml` or Netlify dashboard
- Test redirects after deployment to ensure they work correctly

### Netlify Configuration Example

```toml
# Add to netlify.toml

[[redirects]]
  from = "/docs/getting-started/installation"
  to = "/docs/getting-started/start-new-project"
  status = 301

[[redirects]]
  from = "/docs/getting-started/editor-setup"
  to = "/docs/getting-started/local-development"
  status = 301

[[redirects]]
  from = "/docs/getting-started/ai-setup"
  to = "/docs/getting-started/local-development"
  status = 301

[[redirects]]
  from = "/docs/getting-started/nx-cloud"
  to = "/docs/guides/nx-cloud/intro"
  status = 301

[[redirects]]
  from = "/docs/guides/installation/install-non-javascript"
  to = "/docs/reference/install-non-javascript"
  status = 301

[[redirects]]
  from = "/docs/guides/installation/update-global-installation"
  to = "/docs/troubleshooting/update-global-installation"
  status = 301
```

## Build with Nx & Scale with Nx Reorganization (DOC-365 - Phase 2)

Date: 2024-12-19

### Redirects Required

| Old URL                                                             | New URL                                                            | Status  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| `/docs/features/enforce-module-boundaries`                          | `/docs/scale-with-nx/module-boundaries/overview`                   | Pending |
| `/docs/guides/enforce-module-boundaries/tag-multiple-dimensions`    | `/docs/scale-with-nx/module-boundaries/tag-multiple-dimensions`    | Pending |
| `/docs/guides/enforce-module-boundaries/ban-dependencies-with-tags` | `/docs/scale-with-nx/module-boundaries/ban-dependencies-with-tags` | Pending |
| `/docs/guides/enforce-module-boundaries/ban-external-imports`       | `/docs/scale-with-nx/module-boundaries/ban-external-imports`       | Pending |
| `/docs/guides/enforce-module-boundaries/tags-allow-list`            | `/docs/scale-with-nx/module-boundaries/tags-allow-list`            | Pending |
| `/docs/features/maintain-typescript-monorepos`                      | `/docs/technologies/typescript/maintain-monorepos`                 | Pending |
| `/docs/reference/nx-mcp`                                            | `/docs/features/nx-mcp`                                            | Pending |
| `/docs/reference/conformance/overview`                              | `/docs/scale-with-nx/conformance/overview`                         | Pending |
| `/docs/reference/conformance/create-conformance-rule`               | `/docs/scale-with-nx/conformance/create-conformance-rule`          | Pending |
| `/docs/reference/conformance/test-conformance-rule`                 | `/docs/scale-with-nx/conformance/test-conformance-rule`            | Pending |
| `/docs/reference/conformance/executors`                             | `/docs/scale-with-nx/conformance/executors`                        | Pending |
| `/docs/reference/conformance/generators`                            | `/docs/scale-with-nx/conformance/generators`                       | Pending |
| `/docs/reference/owners/overview`                                   | `/docs/scale-with-nx/owners/overview`                              | Pending |
| `/docs/reference/owners/generators`                                 | `/docs/scale-with-nx/owners/generators`                            | Pending |
| `/docs/guides/tips-n-tricks/define-environment-variables`           | `/docs/guides/define-environment-variables`                        | Pending |
| `/docs/guides/tips-n-tricks/include-assets-in-build`                | `/docs/guides/include-assets-in-build`                             | Pending |
| `/docs/guides/tips-n-tricks/keep-nx-versions-in-sync`               | `/docs/troubleshooting/keep-nx-versions-in-sync`                   | Pending |
| `/docs/guides/tips-n-tricks/standalone-to-monorepo`                 | `/docs/guides/adopting-nx/standalone-to-monorepo`                  | Pending |

### Netlify Configuration

```toml
# Add to netlify.toml

# Module Boundaries
[[redirects]]
  from = "/docs/features/enforce-module-boundaries"
  to = "/docs/scale-with-nx/module-boundaries/overview"
  status = 301

[[redirects]]
  from = "/docs/guides/enforce-module-boundaries/*"
  to = "/docs/scale-with-nx/module-boundaries/:splat"
  status = 301

# TypeScript Monorepos
[[redirects]]
  from = "/docs/features/maintain-typescript-monorepos"
  to = "/docs/technologies/typescript/maintain-monorepos"
  status = 301

# Nx MCP
[[redirects]]
  from = "/docs/reference/nx-mcp"
  to = "/docs/features/nx-mcp"
  status = 301

# Conformance
[[redirects]]
  from = "/docs/reference/conformance/*"
  to = "/docs/scale-with-nx/conformance/:splat"
  status = 301

# Owners
[[redirects]]
  from = "/docs/reference/owners/*"
  to = "/docs/scale-with-nx/owners/:splat"
  status = 301

# Tips-n-Tricks
[[redirects]]
  from = "/docs/guides/tips-n-tricks/define-environment-variables"
  to = "/docs/guides/define-environment-variables"
  status = 301

[[redirects]]
  from = "/docs/guides/tips-n-tricks/include-assets-in-build"
  to = "/docs/guides/include-assets-in-build"
  status = 301

[[redirects]]
  from = "/docs/guides/tips-n-tricks/keep-nx-versions-in-sync"
  to = "/docs/troubleshooting/keep-nx-versions-in-sync"
  status = 301

[[redirects]]
  from = "/docs/guides/tips-n-tricks/standalone-to-monorepo"
  to = "/docs/guides/adopting-nx/standalone-to-monorepo"
  status = 301
```
