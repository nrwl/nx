# documentation .md template

For the colocated doc of a migration generator. Read by humans on nx.dev (the docs site inlines the .md that shares the implementation's basename) and passed to agents as reference material via the `documentation` key. Exemplar: `packages/nx/src/migrations/update-21-0-0/remove-legacy-cache.md`.

Headings start at h4: the docs site nests the content under an h3 entry heading, so h1-h3 would break the page hierarchy.

````markdown
#### <What the migration does, as a short title>

One or two paragraphs: what changes, why (the upstream or Nx change that forced
it), and any user-visible effect after migrating.

#### Sample Code Changes

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
- Optional trailing `#### Reference` section with links to the upstream changelog or guide.
- Name the file after the implementation (`<name>.md` next to `<name>.ts`) so the docs site picks it up; wire the same file into the entry's `documentation` key for agentic runs.
