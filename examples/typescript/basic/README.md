# TypeScript + oxfmt

A slim Nx TypeScript workspace that uses [oxfmt](https://oxc.rs/docs/guide/usage/formatter)
as its formatter instead of Prettier.

Formatting is configured entirely through `.oxfmtrc.json` and the `oxfmt`
dependency — Nx detects it and routes `nx format` through oxfmt automatically.
No Prettier is installed.

## Layout

```
.oxfmtrc.json          oxfmt config (single quotes, 80 column width)
nx.json                @nx/js/typescript plugin only
packages/greeter       one small TypeScript library
```

## Try it

```sh
pnpm install

# Verify everything is formatted, then typecheck
nx format:check
nx run-many -t typecheck

# Format the workspace with oxfmt
nx format:write
```

Introduce a formatting mistake (extra spaces, double quotes) in
`packages/greeter/src/index.ts` and re-run `nx format:check` to see oxfmt flag
it, then `nx format:write` to fix it.
