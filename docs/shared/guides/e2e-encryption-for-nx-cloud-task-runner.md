# End to End Encryption for Nx Cloud Task Runner

To enable end-to-end encryption when using the `"@nrwl/nx-cloud"` task runner, simply provide an encryption key either via [the task runner's configuration options](/{{framework}}/workspace/configuration#tasks-runner-options), or by setting an environment variable with the key: `NX_CLOUD_ENCRYPTION_KEY` with your encryption key.

Nx Cloud will normalize the encryption key's length, so any length key is acceptable for this purpose.
