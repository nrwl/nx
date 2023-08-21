# Switching to ESLint's flat config format

Version 8 of ESLint introduced a new configuration format called [Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new). The next major version will use this config format by default. The purpose of this format is to:

- propose a single configuration format (in contrast to the existing `JSON`, `Yaml` and `JS`-based configs)
- enforce explicit native loading (instead of the implicit imports in `JSON` and `Yaml`)
- use flat cascading of rules (instead of a mix of rules and overrides)

For additional details, head over to their [official blog post](https://eslint.org/blog/2022/08/new-config-system-part-2/).

Since version 16.7.0, Nx supports the usage of flat config in the [@nx/linter:eslint](/packages/linter/executors/eslint) executor and `@nx/*` generators, and provides an automated config conversion from `.eslintrc.json` config files.

## Converting workspace from .eslintrc.json to flat config

To convert workspace ESLint configurations from the default `.eslintrc.json` to new flat config you need to run:

```shell
 nx g @nx/linter:convert-to-flat-config
```

The generator will go through all the projects and convert their configurations to the new format. It will also convert the base `.eslintrc.json` and `.eslintignore`.

## Correctness and best practices

The purpose of this generator is to create a flat config that works the same way, as the original `JSON` config did. Depending on the complexity of your original config, it may be using the `FlatCompat` utility to provide a compatibility wrapper around parts of the original config. You can improve those by following the [official migration guide](https://eslint.org/docs/latest/use/configure/migration-guide).
