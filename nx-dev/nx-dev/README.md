# nx.dev

This folder contains the app and libs to power [nx.dev](https://nx.dev).

## Dynamic Banner

The site supports a dynamic floating banner that can be configured via a remote JSON file. This is useful for promoting events, webinars, or releases without deploying code changes.

### Configuration

Set the `NEXT_PUBLIC_BANNER_URL` environment variable to point to your banner JSON:

```bash
NEXT_PUBLIC_BANNER_URL=https://example.com/banner.json nx serve nx-dev
```

### Banner JSON Schema

```json
{
  "title": "Nx Conf 2025",
  "description": "Join us for the annual Nx conference",
  "primaryCtaUrl": "https://nx.dev/conf",
  "primaryCtaText": "Learn More",
  "secondaryCtaUrl": "https://nx.dev/conf/register",
  "secondaryCtaText": "Register Now",
  "enabled": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Banner headline |
| `description` | string | Yes | Short description text |
| `primaryCtaUrl` | string | Yes | Primary button URL |
| `primaryCtaText` | string | Yes | Primary button text |
| `secondaryCtaUrl` | string | No | Secondary button URL |
| `secondaryCtaText` | string | No | Secondary button text |
| `enabled` | boolean | Yes | Set to `false` to hide the banner |

### Updating Banner Content

To update the banner:

1. Edit the JSON file at the URL specified in `NEXT_PUBLIC_BANNER_URL`
2. Changes take effect immediately (no redeploy needed)
3. To hide the banner, set `enabled: false`

Users can dismiss the banner by clicking the X button. The dismissal is stored in localStorage based on the banner title.
