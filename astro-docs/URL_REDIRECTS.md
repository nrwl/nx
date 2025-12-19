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
