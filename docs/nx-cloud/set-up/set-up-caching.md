# Enabling Distributed Caching

After connecting to Nx Cloud, you will immediately start taking advantage of the distributed caching. To see this in
action
run:

- `nx build YOUR_APP_NAME`
- `nx reset` to remove local cache
- `nx build YOUR_APP_NAME` again to fetch the file artifacts and the terminal output from the cloud

## Skipping Nx Cloud Cache

Similar to how `--skip-nx-cache` will instruct Nx not to use the cache, passing `--no-cloud` will tell Nx not to use Nx
Cloud, only local cache will be used.

### Relevant Documentation

- [Cache Task Results](/core-features/cache-task-results)
- [How Caching Works](/concepts/how-caching-works)
