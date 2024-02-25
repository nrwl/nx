# Cache Security

{% callout type="warning" title="Use Caution With Read-Write Tokens" %}
Read-write tokens allow full write access to your remote cache. They should only be used in trusted environments. For instance, open source projects should only use read-write tokens as secrets configured for protected branches (e.g, main). Read-only tokens should be used in all other cases.
{% /callout %}

A cache allows you to reuse work that has already been done, but it also introduces a potential security risk - cache poisoning. A poisoned cache is one where the cached files have been altered in some way by a malicious actor. When a developer or the CI pipeline use that poisoned cache, the task output will be what the malicious actor wants instead of the correct task output.

Nx takes security seriously and has put in place many precautions (we're [SOC 2 compliant](https://security.nx.app)). Listed below are some precautions that you need to take in your own codebase.

## What Data is Sent to the Cache?

Nx does not send your actual code to the remote cache. There are 3 kinds of data that are sent to the Nx Cloud remote cache for each task:

1. A hash of the inputs to the task. There is no way to reconstitute the actual source code files that were used to create a particular hash value.
2. Any files that were created as outputs from a task.
3. The terminal output created when running the task.

If a malicious actor were able to modify the cache and those output files were then executed, that malicious actor could run arbitrary code on developer machines or in CI.

## Recommended Precautions

In order to keep your cache secure, there are a few steps we recommend you take:

### Specify a Read-Only Token in `nx.json`

The [token you specify](/ci/recipes/security/access-tokens) for the `nxCloudAccessToken` property in `nx.json` is visible to anyone who can view your codebase. If this token was a read-write token someone who doesn't even have permission to create a PR could still add entries to the remote cache, which would then be used on other developer's machines and in CI.

### Use a Read-Write Token in CI

If you're in an environment (like an open source project) where you can't trust the contents of a pull request, we recommend restricting the use of a [read-write token](/ci/recipes/security/access-tokens) in CI to just be used on the `main` branch. If you know that everyone who can make a PR is a trusted developer, you can extend that [read-write token](/ci/recipes/security/access-tokens) to also include pull request branches.

### No Need to Revoke Tokens After Employees Leave

When an employee leaves a company, it is standard practice to change all the passwords that they had access to. That is not necessary for Nx Cloud tokens. In order to poison the cache, the former employee would need to have both the read-write token and the current code on the latest commit on the `main` branch. The odds of the employee being able to guess the hash value that will be created for the current commit on the `main` branch are infinitesimally small even after a single commit.

### Skip the Cache When Creating a Deployment Artifact

In order to guarantee that cache poisoning will never affect your end users, [skip the cache](/features/cache-task-results#turn-off-or-skip-the-cache) when creating build artifacts that will actually be deployed. Skipping the cache for this one CI run is a very small performance cost, but it gives you 100% confidence that cache poisoning will not be an issue for the end users.

### Do Not Manually Share Your Local Cache

Nx implicitly trusts the local cache which is stored by default in the `.nx/cache` folder. You can change the location of that folder in the `nx.json` file, so it could be tempting to place it on a network drive and easily share your cache with everyone on the company network. However, by doing this you've voided the guarantee of immutability from your cache. If someone has direct access to the cached files, they could directly poison the cache. Nx will automatically detect if a cache entry has been created in your local cache using a different machine and warn you with an [Unknown Local Cache Error](/recipes/troubleshooting/unknown-local-cache). Instead, use Nx Cloud [remote caching](/ci/features/remote-cache).

### Configure End to End Encryption

Nx Cloud guarantees your cache entries will remain immutable - once they've been registered they can't be changed. This is guaranteed because the only way to access the cache is through the Nx Cloud API and we have policies enabled in our cloud storage that specifically disables overwrites and deletions of cached artifacts. But what if a hacker were somehow able make their way into the server holding the cache artifacts? Since you set up [end to end encryption](/ci/recipes/security/encryption), the files they see on disk will be fully encrypted with a key that only exists in your workspace.

### Use An On-Premise Version of Nx Cloud If Needed

If you need to have all cache artifacts on servers that you control, there is an on-premise version of Nx Cloud that you can use as part of the [Enterprise plan](https://nx.app/enterprise).

## Security Decisions

In any security discussion, there is a trade off between convenience and security. It could be that some of these threats do not apply to your organization. If that is the case you could relax some of the security precautions and gain the performance benefits of more task results being stored in the remote cache. Every organization is different and Nx can be adapted to best meet your needs without opening up vulnerabilities. If you would Nx team members to help your organization fine tune your set up, [talk to us about Nx Enterprise](https://nx.app/enterprise).
