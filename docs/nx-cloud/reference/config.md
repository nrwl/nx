# Configuring the Cloud Runner / Nx CLI
The Nx Cloud runner is configured in `nx.json`.

```json
{
  "tasksRunnerOptions": {
    "default": {
       "runner": "@nrwl/nx-cloud",
       "options": {
           "accessToken": "SOMETOKEN",
           "cacheableOperations": ["build", "test", "lint", "e2e"],
        }
      }
   },
}
```

## Cacheable Operations 
Only operations listed in `cacheableOperations` can be cached using Nx Cloud and distributed using the distributed task execution (DTE). You can add new targets to that list.

## Timeouts 
By default, Nx Cloud requests will time out after 10 seconds. `NX_CLOUD_NO_TIMEOUTS` disables the timeout.

```bash
NX_CLOUD_NO_TIMEOUTS=true nx run-many --target=build --all
```

## Logging 
Setting `NX_VERBOSE_LOGGING=true` when running a command will emit a large amount of metadata It will print information about what artifacts are being downloaded and uploaded, as well as information about the hashes of every computation.

This can be useful for debugging unexpected cache misses, and issues with Nx Private Cloud setups.

`NX_VERBOSE_LOGGING=true` will also print detailed information about distributed task execution, such as what commands were sent where, etc.

`NX_VERBOSE_LOGGING` is often enabled in CI globally while debugging your CI setups.

## Access Tokens 
`NX_CLOUD_AUTH_TOKEN` and `NX_CLOUD_ACCESS_TOKEN` are aliases of each other. This configuration allows you to override the access token set in `nx.json`. It is often enabled in CI to provide read-write privileges where only a read token is committed to the workspace's `nx.json`.

## Enabling End-to-End Encryption 
All communication with Nx Cloud’s API and cache is completed over HTTPS, but you can optionally enable e2e encryption by providing a secret key through `nx.json` or the `NX_CLOUD_ENCRYPTION_KEY` environment variable.

In `nx.json`, locate the `taskRunnerOptions` property. It will look something like this:

```json
{
  "tasksRunnerOptions": {
    "default": {
       "runner": "@nrwl/nx-cloud",
       "options": {
           "accessToken": "SOMETOKEN",
           "cacheableOperations": ["build", "test", "lint", "e2e"],
           // Add the following property with your secret key
           "encryptionKey": "cheddar"
        }
      }
   },
}
```

Under the options property, you can add an additional property called `encryptionKey`. This is what will be used to encrypt your artifacts.

To instead use an environment variable to provide your secret key, run any Nx command as follows:

```bash
NX_CLOUD_ENCRYPTION_KEY=myEncryptionKey nx build my-project
```

This is an alternative to providing the encryption key through `nx.json`, but functionally it is identical.

## Loading Env Variables From a File 
If you create an env file called `nx-cloud.env` at the root of the workspace, the Nx Cloud runner is going to load `NX_CLOUD_ENCRYPTION_KEY` and `NX_CLOUD_AUTH_TOKEN` from it. The file is often added to `.gitignore`.
