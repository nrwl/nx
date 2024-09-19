# tasksRunnerOptions and cacheDirectory

As of Nx 20, custom task runners (defined via `tasksRunnerOptions`) and the `cacheDirectory` property in `nx.json` are deprecated. They will cease to function in Nx 21. In Nx 20, the local cache is stored in a database, rather than using the file system. This has two benefits:

1. Cache reads and writes are faster.
2. The local cache is more secure since other processes with access to the file system can no longer read or modify the cache.

For most organizations, this feature is a net positive. If you are currently using a custom task runner, you are mostly likely using it to define your own custom [remote cache](/ci/features/remote-cache) storage location. You have several options moving forward:

1. Use [Nx Cloud](/nx-cloud) for your remote cache
2. Use an [Nx Powerpack]() plugin to store your remote cache on an [AWS S3 bucket](/nx-api/powerpack-s3-cache) or a [network drive]()
3. Use the deprecated custom task runner feature until Nx 21
