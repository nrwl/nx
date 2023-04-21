```bash
nx g @nx/esbuild:esbuild-project my-package
```

{% callout type="note" title="Overwriting existing build option" %}
The `esbuild-projet` generator validates that an existing `build` target isn't already defined for the project. If you are adding esbuild to a project with an existing `build` target, pass the `--skipValidation` option.
{% /callout %}

You may also provide a custom main entry file, or a custom tsconfig file if the defaults don't work. By default, the generator will look for a main file matching `src/index.ts` or `src/main.ts`, and a tsconfig file matching `tsconfig.app.json` or `tsconfig.lib.json`.

```bash
nx g @nx/esbuild:esbuild-project my-package \
--main=packages/my-package/src/entry.ts \
--tsConfig=packages/my-package/tsconfig.custom.json
```
