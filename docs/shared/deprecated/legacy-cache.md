# Legacy Cache

## tasksRunnerOptions

As of Nx 20, the `tasksRunnerOptions` property in `nx.json` is deprecated. This property was used to register custom task runners. `tasksRunnerOptions` and custom task runners only work with the legacy file system cache.

## NX_REJECT_UNKNOWN_LOCAL_CACHE

The `NX_REJECT_UNKNOWN_LOCAL_CACHE` environment variable only works with the legacy file system local cache.

## Next Steps

In Nx 20, the local cache metadata and project graph are stored in a database, rather than using the file system. (Cache artifacts are still stored on the file system.) In Nx 21 the legacy file system cache will be removed and the database cache will be the only option. The database cache has two benefits:

1. Cache reads and writes are faster.
2. The local cache is more secure since other processes with access to the file system can no longer read or modify the cache.

For most organizations, this feature is a net positive. If you are currently using a custom task runner or the `NX_REJECT_UNKNOWN_LOCAL_CACHE` environment variable, you are most likely providing your own custom [remote cache](/ci/features/remote-cache) storage location. You have several options moving forward:

1. Use [Nx Cloud](/nx-cloud) for your remote cache
2. Use an [Nx Powerpack](/powerpack) plugin to store your remote cache on [Amazon S3](/nx-api/powerpack-s3-cache), [Google Cloud](/nx-api/powerpack-gcs-cache), [Azure](/nx-api/powerpack-azure-cache) or a [network drive](/nx-api/powerpack-shared-fs-cache)
3. Use the legacy file system cache until Nx 21 by setting `useLegacyCache: true` in your `nx.json` file
