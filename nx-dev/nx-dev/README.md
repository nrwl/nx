# nx.dev

This folder contains the app and libs to power [nx.dev](https://nx.dev).

## Banner Configuration

The floating banner promotes events/webinars. It's loaded at **build time** for static generation.

### Updating the Banner

**Preferred:** Set `NEXT_PUBLIC_BANNER_URL` in Vercel to a hosted JSON file. This allows updates without code changes.

**Temporary:** Until the env var is configured in Vercel, edit `lib/banner-config.json` directly:

```json
{
  "id": "event-id",
  "title": "Event Title",
  "description": "Event description",
  "primaryCtaUrl": "https://...",
  "primaryCtaText": "Learn More",
  "secondaryCtaUrl": "",
  "secondaryCtaText": "",
  "enabled": true
}
```

- **id**: Unique ID. Changing it resets dismissals for all users.
- **enabled**: Set `false` to hide the banner.
