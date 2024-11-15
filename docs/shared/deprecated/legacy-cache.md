# Legacy Cache

In Nx 21, the legacy file system cache will be removed in favor of a new database cache. The new database cache stores metadata in a database, rather than blindly trusting the file system. The database cache has the following benefits:

1. Cache reads and writes are faster.
2. The local cache is more secure since Nx will no longer retrieve artifacts it does not recognize.

The legacy file system cache can still be used in Nx 20 by setting `useLegacyCache: true` in your `nx.json` file. To gain the benefits above, remove `useLegacyCache: true` from your `nx.json`.

If you are currently using a custom task runner or the `NX_REJECT_UNKNOWN_LOCAL_CACHE` environment variable continue reading below.

## tasksRunnerOptions

As of Nx 20, the `tasksRunnerOptions` property in `nx.json` is deprecated. This property was used to register custom task runners. `tasksRunnerOptions` and custom task runners will not work with the new database cache.

If you are using `tasksRunnerOptions`, you have a few options moving forward:

1. Use [Nx Cloud](/nx-cloud) for your remote cache. This is the safest, lowest-maintenance, most recommended option
2. If you cannot use Nx Cloud, consider an [Nx Powerpack](/powerpack) plugin for caching: [Amazon S3](/nx-api/powerpack-s3-cache), [Google Cloud](/nx-api/powerpack-gcs-cache), [Azure](/nx-api/powerpack-azure-cache) or a [shared network drive](/nx-api/powerpack-shared-fs-cache)
3. If there is no Powerpack plugin that supports the service where you want to store the remote cache, [file an issue](https://github.com/nrwl/nx/issues/new)

## NX_REJECT_UNKNOWN_LOCAL_CACHE

The `NX_REJECT_UNKNOWN_LOCAL_CACHE` environment variable does not work with the new database cache. We have introduced a new cache which will recognize artifacts from other machines.

If you are using `NX_REJECT_UNKNOWN_LOCAL_CACHE` to share your local cache on a network drive, you have a few options moving forward:

1. Use [Nx Cloud](/nx-cloud) for your remote cache. This is the safest, lowest-maintenance, most recommended option
2. Use the [Nx Powerpack Shared Fs Cache](/nx-api/powerpack-shared-fs-cache) which recognizes artifacts from other machines
3. Use another [Nx Powerpack](/powerpack) plugin for caching on a cloud provider: [Amazon S3](/nx-api/powerpack-s3-cache), [Google Cloud](/nx-api/powerpack-gcs-cache), or [Azure](/nx-api/powerpack-azure-cache)
