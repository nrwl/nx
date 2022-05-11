# Nx Private Cloud Advanced Configuration
## Configure Memory Limits
By default, the Nx Cloud container is configured to run on an instance with 8GB of RAM.

If you have a container with 4GB of RAM, you can decrease the memory limits by setting the following env variables:

- `NX_CLOUD_FILE_SERVER_MEMORY_LIMIT=500`
- `NX_CLOUD_API_MEMORY_LIMIT=800`
- `NX_CLOUD_DATABASE_MEMORY_LIMIT=1`

Example:

```bash
> docker create --name cloud \
    -p 80:8081 \
    -e NX_CLOUD_APP_URL="https://cloud.myorg.com" \
    -e ADMIN_PASSWORD=admin \
    -e NX_CLOUD_FILE_SERVER_MEMORY_LIMIT=500 \
    -e NX_CLOUD_API_MEMORY_LIMIT=800 \
    -e NX_CLOUD_DATABASE_MEMORY_LIMIT=1 \
    -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

The right amount of RAM depends heavily on how you run Nx Cloud.

- The `NX_CLOUD_FILE_SERVER_MEMORY_LIMIT` value is only relevant if you use the built-in file server.
- The `NX_CLOUD_DATABASE_MEMORY_LIMIT` value is only relevant if you use the built-in database.

For instance, if you use S3 to store the cached artifacts and you host Mongo DB yourself, even 2GB might be sufficient. You can set the following limit:

- `NX_CLOUD_API_MEMORY_LIMIT=800`

If you run everything in the Nx Cloud container, then 8GB is much preferred.

## Configure Artifact Expiration When Using Built-in File Server
By default, the Nx Cloud container is going to remove cached artifacts after two weeks. You can change it by setting `NX_CACHE_EXPIRATION_PERIOD_IN_DAYS` when starting the container.

Example:

```bash
> docker create --name cloud \
    -p 80:8081 \
    -e NX_CLOUD_APP_URL="https://cloud.myorg.com" \
    -e ADMIN_PASSWORD=admin \
    -e NX_CACHE_EXPIRATION_PERIOD_IN_DAYS=5 \
    -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

## Self-Signed Certificates
If you have a self-signed certificate, you will have to provision `NODE_EXTRA_CA_CERTS`. The env variable should point to a PEM file with either your certificate, or the root certificate your certificate was created from. Though this can be accomplished with a CLI command like `NODE_EXTRA_CA_CERTS=./tools/certs/cert.crt nx test myapp`, you will most likely want to configure it as a global env variable (for instance in your `.bashrc` file).

A self-sign certificate registered in your OS won't be picked up by Node. Node requires you to provision `NODE_EXTRA_CA_CERTS`.

## Troubleshooting and Verbose Logging
To help troubleshoot installations, add the following env variables when starting the container:

```
-e NX_VERBOSE_LOGGING=true
-e NX_API_LOG_LEVEL=DEBIG
-e NX_MONGO_LOG_LEVEL=DEBUG
```
