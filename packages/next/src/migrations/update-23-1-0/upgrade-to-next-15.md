#### Upgrade Next.js 14 to 15

Bumps Next.js from 14 to 15 (and `eslint-config-next` to match). The main breaking change is that the request APIs (`params`, `searchParams`, `cookies`, `headers`, `draftMode`) are now asynchronous. App Router projects also require React 19; Page Router projects can stay on React 18. Read more in the [Next.js 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15).

The paired AI instructions migration walks an agent through the full set of changes. The common ones are shown below.

#### Examples

##### Before

```tsx title="app/blog/[slug]/page.tsx"
export default function Page({ params, searchParams }) {
  const { slug } = params;
  const query = searchParams.q;
  return <h1>{slug}</h1>;
}
```

##### After

```tsx title="app/blog/[slug]/page.tsx"
export default async function Page(props) {
  const { slug } = await props.params;
  const { q: query } = await props.searchParams;
  return <h1>{slug}</h1>;
}
```

`cookies`, `headers`, and `draftMode` are awaited the same way (`const store = await cookies();`).

#### Page Router

Pages Router data functions are not affected: `getServerSideProps` / `getStaticProps` / `getStaticPaths` `context.params` stays synchronous - leave it unchanged.
