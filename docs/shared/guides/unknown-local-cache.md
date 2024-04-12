# Unknown Local Cache Error

This document will explain why the following error happens and how to address it.

```
NX Invalid Cache Directory for Task "myapp:build"

The local cache artifact in ".nx/cache/nx/786524780459028195" was not generated on this machine.
As a result, the cache's content integrity cannot be confirmed, which may make cache restoration potentially unsafe.
If your machine ID has changed since the artifact was cached, run "nx reset" to fix this issue.
Read about the error and how to address it here: https://nx.dev/troubleshooting/unknown-local-cache
```

## Nx Tracks Cache Source

Nx can cache tasks, which can drastically speed up your CI and local builds. However, this comes with the potential risk
of "cache poisoning", where cache artifacts could be intentionally or inadvertently overwritten. If another user
executes a task that matches the hash of the tainted artifact, they could retrieve the corrupted artifact and use it as
the outcome of the task. Nx and Nx Cloud contain several safeguards to minimize the likelihood of cache poisoning or, in
the case of Nx Cloud, completely prevent it.

The error above is one such safeguard.

Nx trusts the local cache. If you executed a task and stored the corresponding cached artifact on your machine, you can
safely restore it on the same machine without worrying about cache poisoning. After all, in order to tamper with the
cache artifact, the actor would need access to the machine itself.

However, when artifacts in the local cache are created by a different machine, we cannot make such assumption. By
default, Nx will refuse to use such artifacts and will throw the "Invalid Cache Directory" error.

## Your MachineId Has Changed

Upgrading your computer's hardware may alter its Machine ID, yielding the error above. To fix it execute `nx reset` to
remove all the cache directories created under the previous Machine ID. After doing so, you should no longer see the
error.

## You Share Cache with Another Machine Using a Network Drive

You can prefix any Nx command with `NX_REJECT_UNKNOWN_LOCAL_CACHE=0` to ignore the error (
e.g., `NX_REJECT_UNKNOWN_LOCAL_CACHE=0 nx run-many -t build test`). This is similar to
setting `NODE_TLS_REJECT_UNAUTHORIZED=0` to ignore any errors stemming form self-signed certificates. Even though it
will make it work, this approach is discouraged.

Storing Nx's local cache on a network drive can present security risks. When a network drive is shared, every CI run has
access to all the previously created Nx cache artifacts. Hence, it is plausible for every single artifact - for every
single task hash - to be accessed without leaving any trace. This is feasible due to the network drive's capability to
allow overwrites.

Instead of sharing the network drive, we highly recommend you to implement the `RemoteCache` interface.

## Implementing Remote Cache Interface

This is the interface:

```typescript
interface RemoteCache {
  retrieve(hash: string, cachePath: string);

  store(hash: string, cachePath: string);
}
```

> You will need to wrap the default tasks runner to provide the remote cache implementation.

## How Nx Cloud Makes Sure Sharing Cache is Safe

The Nx Cloud runner provides an implementation of `RemoteCache` which does the following things making sharing the cache safe:

1. **Immutable Artifacts:** Nx Cloud allows you to create and store new artifacts without the ability to override the
   existing ones. This prevents any possibility of poisoning an existing artifact. This is achieved by managing the
   cache using short-lived signed URLs.

2. **Artifact Accessibility:** Nx Cloud provides access to the cache artifact specifically for the task that is
   currently being executed. It restricts the ability to list all cache artifacts.

3. **Visibility Control:** Nx Cloud comes with options to manage the visibility of your cache artifacts. For instance,
   the cache artifacts created in `main` might be accessible by anyone across any branch, whereas the artifacts created
   in your PR could be shared only within your PR runs.

4. **Access Token Traceability:** Nx Cloud keeps a record of the access token used to create a cache artifact. In case
   an access token gets compromised it can be easily removed, in turn deleting all the cache artifacts that were created
   using it.

Nx Cloud is not the only remote cache you can use. If you are using a different remote cache or using your
own implementation, we would highly recommend ensuring that the same safety mechanisms as Nx Cloud have been put in
place.
