# Interactive figures

Animated React figures embedded in docs pages with the `figure` Markdoc tag:

```
{% figure name="ultracache" height=540 caption="What the figure shows, in one or two sentences." /%}
```

- `name`: a key of `FIGURES` in `registry.ts`.
- `height`: the space reserved before the figure loads, in pixels, so the page doesn't jump.
- `caption`: required. Agents read the raw `.mdoc`, so the caption has to make sense without the animation.

The figure code is generated. The source of truth is `apps/blog-figures` in
[nrwl/content-animations](https://github.com/nrwl/content-animations), the same
figures the Nx blog uses. Edit them there and sync:

```shell
node apps/blog-figures/scripts/sync-to-blog.mjs <nx>/astro-docs/src/components/interactive
```

The script overwrites the figure files and `brand-tokens.ts`. `registry.ts`,
`InteractiveFigure.tsx` and this README are owned by the docs and left alone.
