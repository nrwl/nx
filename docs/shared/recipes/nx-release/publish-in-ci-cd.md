# Publish in CI/CD

Nx Release makes it easy to move your publishing process into your CI/CD pipeline.

## Skip Publishing Locally

When running `nx release`, after the version updates and changelog generation, you will be prompted with the following question:

```{% command="nx release" %}
? Do you want to publish these versions? (y/N) ›
```

To move publishing into an automated pipeline, you will want to skip publishing locally. To automatically skip publishing when running `nx release`, use the `--skip-publish` flag:

```{% command="nx release --skip-publish" %}
...

Skipped publishing packages.
```
