# Analysing & visualizing dependencies

To be able to support the monorepo-style development, the tools must know how different projects in your workspace depend on each other. Nx uses advanced code analysis to build this dependency graph.

You can visualize it by running `npm run dep-graph` or `yarn dep-graph`.

![dependency-graph](//images.ctfassets.net/8eyogtwep6d2/7M6FSiQ75K8gu8G4QqSsSa/111f85a98ed129c53a86c0edf4bd2912/dependency-graph.png)

You can also visualize what is affected by your change, by using the `affected:dep-graph` command.

![dependency-graph-affected](//images.ctfassets.net/8eyogtwep6d2/1375oQexPaKikmICIAa2q4/904272360ba3f2a3469fbeeab62efdb1/dependency-graph-affected.png)

# Available options

Run `npm run affected:dep-graph -- --help` or `yarn affected:dep-graph --help` to see the available options:

```
Graph dependencies affected by changes

Run command using --base=[SHA1] --head=[SHA2]:
  --base  Base of the current branch (usually master)                   [string]
  --head  Latest commit of the current branch (usually HEAD)            [string]

or using:
  --files        A list of files delimited by commas                     [array]
  --uncommitted  Uncommitted changes
  --untracked    Untracked changes

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
  --file     output file (e.g. --file=.vis/output.json)
```

First, you need to tell Nx what you changed, and you can do it in one of the following ways:

- `npm run affected:dep-graph -- --base=[SHA1] --base=[SHA2]` or `yarn affected:dep-graph --base=[SHA1] --base=[SHA2]`. Nx will calculate what changed between the two SHAs, and will graph what is affected by the change. For instance, `yarn affected:dep-graph --base=origin/master --base=HEAD` will show what is affected by a PR.
- `npm run affected:dep-graph -- --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts` or `yarn affected:dep-graph --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts`. Nx will graph what is affected by changing the two index files.
- `npm run affected:dep-graph -- --uncommitted` or `yarn affected:dep-graph --uncommitted`. Nx will graph what is affected by the uncommitted files (this is useful during development).
- `npm run affected:dep-graph -- --untracked` or `yarn affected:dep-graph --untracked`. Nx will graph what is affected by the untracked files (this is useful during development).

By default, the `dep-graph` and `affected:dep-graph` commands will open the browser to show the graph, but you can also output the graph into a file by running:

- `npm run dep-graph -- --file=graph.json` or `yarn dep-graph --file=graph.json` will emit a json file.
- `npm run dep-graph -- --file=graph.dot` or `yarn dep-graph --file=graph.dot` will emit a dot file.
- `npm run dep-graph -- --file=graph.svg` or `yarn dep-graph --file=graph.svg` will emit an svg file.
