#### Add Vite Temp Files to Git Ignore

Add gitignore entry for temporary vite config files.

#### Sample Code Changes

Adds the following entries to the `.gitignore` file.

```text title=".gitignore"
vite.config.*.timestamp*
vitest.config.*.timestamp*
```
