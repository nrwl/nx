# nx.dev

This folder contains the app and libs to power [nx.dev](https://nx.dev).

## Banner Configuration

The floating banner promotes events/webinars. It's fetched at **build time** from a Framer CMS page and stored locally.

### Setup

Set `NEXT_PUBLIC_BANNER_URL` to point to a Framer page that renders banner JSON:

```
NEXT_PUBLIC_BANNER_URL=https://your-framer-site.framer.app/api/banners/main
```

The Framer page should render JSON inside a `<pre>` tag:

```json
{
  "title": "Event Title",
  "description": "Event description",
  "primaryCtaUrl": "https://...",
  "primaryCtaText": "Learn More",
  "secondaryCtaUrl": "",
  "secondaryCtaText": "",
  "enabled": true,
  "activeUntil": "2025-12-31T00:00:00.000Z"
}
```

### Schema

| Field              | Type     | Required | Description               |
| ------------------ | -------- | -------- | ------------------------- |
| `title`            | string   | Yes      | Banner headline           |
| `description`      | string   | Yes      | Banner body text          |
| `primaryCtaUrl`    | string   | Yes      | Primary button URL        |
| `primaryCtaText`   | string   | Yes      | Primary button text       |
| `secondaryCtaUrl`  | string   | No       | Secondary button URL      |
| `secondaryCtaText` | string   | No       | Secondary button text     |
| `enabled`          | boolean  | Yes      | Show/hide the banner      |
| `activeUntil`      | ISO 8601 | No       | Auto-hide after this date |

### Behavior

- Banner is fetched during `prebuild-banner` target and saved to `lib/banner.json` as a collection (array)
- Requires rebuild/redeploy to update the banner
- Users can dismiss the banner (stored in localStorage)
- If `enabled` is `false` or `activeUntil` has passed, the banner won't show
- If `NEXT_PUBLIC_BANNER_URL` is not set, an empty collection is generated
