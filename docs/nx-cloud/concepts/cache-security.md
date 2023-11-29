# Remote Cache Security

{% callout type="warning" title="Use Caution With Read-Write Tokens" %}
Read-write tokens allow full write access to your remote cache. They should only be used in trusted environments. For instance, open source projects should only use read-write tokens as secrets configured for protected branches (e.g, main). Read-only tokens should be used in all other cases.
{% /callout %}

A cache allows you to reuse work that has already been done, but it also introduces a potential security risk - cache poisoning. A poisoned cache is one where the cached files have been altered in some way by a malicious actor. When a developer or the CI pipeline use that poisoned cache, the task output will be what the malicious actor wants instead of the correct task output.

Nx takes security seriously and has put in place many precautions (we're [SOC 2 compliant](https://security.nx.app)). Listed below are some precautions that you need to take in your own codebase.

## Recommended Precautions

In order to keep your cache secure, there are a few steps we recommend you take:

- Specify a [read-only token](/nx-cloud/recipes/security/access-tokens) in the `nx.json` file
- Use a [read-write token](/nx-cloud/recipes/security/access-tokens) only in the `main` branch in CI, not on pull request branches.
- When building the actual deployment artifact, [skip the cache](/core-features/cache-task-results#turn-off-or-skip-the-cache)
- Do not [manually share your local cache](/recipes/troubleshooting/unknown-local-cache) folder. Use Nx Cloud [remote caching](/nx-cloud/features/remote-cache) instead.
- Configure [end to end encryption](/nx-cloud/recipes/security/encryption)

If you need to have all cache artifacts on servers that you control, there is an on-premise version of Nx Cloud that you can use as part of the [Enterprise plan](https://nx.app/enterprise).

## Consequences of a Security Incident

Nx does not send your actual code to the remote cache. There are 3 kinds of data that are sent to the Nx Cloud remote cache for each task:

1. A hash of the inputs to the task. There is no way to reconstitute the actual source code files that were used to create a particular hash value.
2. Any files that were created as outputs from a task.
3. The terminal output created when running the task.

If a malicious actor were able to modify the cache and those output files were then executed, that malicious actor could run arbitrary code on developer machines or in CI.

## Potential Malicious Actors

The following section describes different personas that might be malicious actors and how the precautions taken above would counter their nefarious intent.

### A Contractor with Read-Only Access to the Codebase

Because you specified a [read-only token](/nx-cloud/recipes/security/access-tokens) in the `nx.json` file, the contractor would not be able to upload anything to the remote cache. They could use the cache to run tasks quickly, but their actions couldn't affect anyone else's cache.

### A Former Employee that Had Access to a Read-Write Access Token

It is possible to revoke a token and issue a new one, but in practice this is unnecessary. In order to poison the cache, the former employee would need to have both the read-write token and the current code on the latest commit on the `main` branch. The odds of the employee being able to guess the hash value that will be created for the current commit on the `main` branch are infinitesimally small even after a single commit.

### A Developer that Is Able to Create Pull Requests

In an open source environment, anyone in the world can create pull requests so you can't trust the pull request to be safe. This is why we recommend using a [read-write token](/nx-cloud/recipes/security/access-tokens) only for the `main` branch. If you are in a closed source environment where you trust all the developers that have access to create a PR, you could extend that [read-write token](/nx-cloud/recipes/security/access-tokens) to also include PR branches.

### An IT Staffer with Access to a Manually Shared Cache Folder

Nx implicitly trusts the local cache which is stored by default in the `.nx/cache` folder. You can change the location of that folder in the `nx.json` file, so it could be tempting to place it on a network drive and easily share your cache with everyone on the company network. However, by doing this you've voided the guarantee of immutability from your cache. If someone has direct access to the cached files, they could directly poison the cache. Nx will automatically detect if a cache entry has been created in your local cache using a different machine and warn you with an [Unknown Local Cache Error](/recipes/troubleshooting/unknown-local-cache).

### A Hacker that Gained Access to the Nx Cloud Servers

Nx Cloud guarantees your cache entries will remain immutable - once they've been registered they can't be changed. This is guaranteed because the only way to access the cache is through the Nx Cloud API. But what if a hacker were somehow able make their way into the server holding the cache artifacts? Since you set up [end to end encryption](/nx-cloud/recipes/security/encryption), the files they see on disk will be fully encrypted with a key that only exists in your workspace. The worst they could do is mangle the file, making your cached results come back as nonsense.

## Security Decisions

In any security discussion, there is a trade off between convenience and security. It could be that some of these potential malicious actors are not actually threats in your organization. If that is the case you could relax some of the security precautions and gain the performance benefits of more task results being stored in the remote cache. Every organization is different and Nx can be adapted to best meet your needs without opening up vulnerabilities. If you would Nx team members to help your organization fine tune your set up, [talk to us about Nx Enterprise](https://nx.app/enterprise).
