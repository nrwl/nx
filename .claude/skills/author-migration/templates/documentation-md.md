# documentation .md template

For the colocated doc of a migration entry. Read by humans on nx.dev and handed to agents as reference material; both consumers resolve it from the entry's `documentation` key. Exemplar: `packages/nx/src/migrations/update-21-0-0/remove-legacy-cache.md`.

Headings start at h4: the docs site nests the content under an h3 entry heading, so h1-h3 would break the page hierarchy.

````markdown
#### <What the migration does, as a short title>

One or two paragraphs: what changes, why (the upstream or Nx change that forced
it), and any user-visible effect after migrating.

#### Sample code changes

Optional one-line setup for the example.

##### Before

```ts title="apps/app1/vite.config.ts"
<before>
```

##### After

```ts title="apps/app1/vite.config.ts"
<after>
```
````

Rules:

- Use the `title="<file path>"` attribute on fenced blocks so readers see where the change lands.
- Multiple distinct changes get multiple Before/After pairs, each under its own h5 or with a one-line lead-in.
- The Sample code changes section is for changes with a code shape; omit it when there is none (a removed cache flag, a moved directory).
- These files render on nx.dev, so the docs style rules apply: `astro-docs/STYLE_GUIDE.md`, sentence-case headings per the site's `Nx.Headings` vale rule. Vale's scope does not reach these files today (it lints only `astro-docs/src/content`), so self-check; many shipped migration docs predate this and use title case.
- Optional trailing `#### Reference` section with links to the upstream changelog or guide.
- Name the file after the implementation (`<name>.md` next to `<name>.ts`); the shared name is pairing convention, and the docs site and agentic runs both resolve the file from the entry's `documentation` key.
- Prompt migrations use the what-the-upgrade-involves genre instead: prose on what the upgrade involves and what is automated, named `upgrade-to-<framework>-<major>.md` (exemplar: `packages/react/src/migrations/update-23-1-0/upgrade-to-react-19.md`). It renders on the docs page and reaches agents through the `documentation` key like any other entry.
