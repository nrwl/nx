# migrations.json entry templates

Replace `<...>` placeholders. Migration entries go under the file's top-level `generators` section, packageJsonUpdates groups under `packageJsonUpdates` (full file shape at the bottom). Version values follow the target-train rule from SKILL.md section 2. Paths are dist-prefixed because they resolve against the installed package. The examples below use `./dist/src/migrations/...`, the shape for packages whose `tsconfig.lib.json` has `rootDir: "."` (the dominant shape); packages that set `rootDir: "src"` publish without the `src` segment (`./dist/migrations/...`, e.g. dotnet and maven). Copy the shape from a sibling entry, or for a package's first entry derive it from `rootDir` and confirm the path exists under the built `dist/`; path validation strips `dist/` and resolves the source file, so the dangerous wrong shape (`./dist/src/...` in a `rootDir: "src"` package) still resolves and passes, while only shapes whose stripped path misses the source tree fail.

## Generator-only

```json
"update-23-2-0-remove-foo-option": {
  "version": "23.2.0-beta.3",
  "description": "Removes the deprecated `foo` option from the @nx/bar:build executor options",
  "implementation": "./dist/src/migrations/update-23-2-0/remove-foo-option",
  "documentation": "./dist/src/migrations/update-23-2-0/remove-foo-option.md"
}
```

Add `requires` when the migration only applies past an upstream major:

```json
"requires": { "bar": ">=4.0.0" }
```

## Prompt-only

```json
"update-23-2-0-migrate-bar-config-format": {
  "version": "23.2.0-beta.3",
  "requires": { "bar": ">=4.0.0" },
  "description": "AI-assisted migration: rewrites bar config files to the v4 format, whose options do not map 1:1, so it is driven by an AI prompt rather than a deterministic generator",
  "prompt": "./dist/src/migrations/update-23-2-0/migrate-bar-config-format.md",
  "documentation": "./dist/src/migrations/update-23-2-0/upgrade-to-bar-v4.md"
}
```

## Hybrid (deterministic pre-pass plus AI half)

One entry, both keys. The prompt filename must differ from the implementation basename (the `documentation` .md owns that name; SKILL.md section 4).

```json
"update-23-2-0-convert-bar-config": {
  "version": "23.2.0-beta.3",
  "requires": { "bar": ">=4.0.0" },
  "description": "Converts bar configuration to the v4 format; mechanically safe conversions are applied by a generator and the remainder is completed by an AI prompt",
  "implementation": "./dist/src/migrations/update-23-2-0/convert-bar-config",
  "prompt": "./dist/src/migrations/update-23-2-0/finish-bar-config-conversion.md",
  "documentation": "./dist/src/migrations/update-23-2-0/convert-bar-config.md"
}
```

## packageJsonUpdates

Plain bump for the target train:

```json
"23.2.0": {
  "version": "23.2.0-beta.3",
  "packages": {
    "bar": { "version": "^4.1.0", "alwaysAddToPackageJson": false }
  }
}
```

Cross-major bump gated on the source major (one group per supported source major, ordered oldest first):

```json
"23.2.0-bar-v4": {
  "version": "23.2.0-beta.3",
  "requires": { "bar": ">=3.0.0 <4.0.0" },
  "packages": {
    "bar": { "version": "^4.1.0", "alwaysAddToPackageJson": false }
  }
}
```

Bumping a package that ships its own migrations, without triggering them:

```json
"packages": {
  "some-cli": {
    "version": "~5.0.0",
    "alwaysAddToPackageJson": false,
    "ignorePackageGroup": true,
    "ignoreMigrations": true
  }
}
```

## First migration in a plugin: package.json wiring

```json
"nx-migrations": {
  "migrations": "./migrations.json",
  "supportsOptionalMigrations": true
}
```

And a new migrations.json has this shape:

```json
{
  "$schema": "../../node_modules/nx/schemas/migrations-schema.json",
  "generators": {},
  "packageJsonUpdates": {}
}
```
