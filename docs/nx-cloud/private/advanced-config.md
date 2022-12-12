# Advanced Configuration

## Troubleshooting and Verbose Logging

To help troubleshoot installations, add the following env variables when starting the container:

```
-e NX_VERBOSE_LOGGING=true
-e NX_API_LOG_LEVEL=DEBUG
-e NX_MONGO_LOG_LEVEL=DEBUG
```

or if using helm set `verboseLogging` to `'true'`:

```yaml
image:
  tag: 'latest'

verboseLogging: 'true'
```

## Running the Mongo Database

Nx Cloud uses MongoDB to store its metadata. There are several common ways to run MongoDB.

### Using MongoDB Kubernetes Operator

The MongoDB team maintains the open
source [MongoDB Kubernetes Operator](https://github.com/mongodb/mongodb-kubernetes-operator). You can use it to set up
your own deployment of MongoDB. See [the Nx Cloud Kubernetes example](https://github.com/nrwl/nxcloud-k8s-setup) for
more information.

### Using CosmosDB

If you are deploying to Azure, you might have access to CosmosDB. See here for more information.

### Using Mongo Atlas

[Mongo Atlas](https://mongodb.com/) is a great option for deploying MongoDB.

## Using External File Storage

By default, the on-prem version of Nx Cloud is going to start a file server and store the cached artifacts in the
provided volume. But
you can also configure Nx Cloud to use an external file storage. At the moment, only S3 and Azure Blob are
supported.

### Using S3/Minio

To configure S3 as a file storage, provision the `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET`
env variables for the `nx-cloud-nx-api` container.

If you are using an accelerated bucket, et: `AWS_S3_ACCELERATED` to `true`

If you are using a local S3 installation (e.g., Minio), you will also need to set `AWS_S3_ENDPOINT`.

{% callout type="note" title="On cache item expiration time" %}
Remember to
set [a cache item expiration time](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html)
. The default is currently 4 weeks. If you would like to keep items for longer, for example for 8 weeks, please remember
to set the `NX_CACHE_EXPIRATION_PERIOD_IN_DAYS=56` env variable as well, so the container knows when to expire the Mongo
cache entries as well.
{% /callout %}

### Using Azure

To configure Azure Blob as a file storage, provision the `AZURE_CONNECTION_STRING`, `AZURE_CONTAINER` env variables for the `nx-cloud-nx-api` container.

To obtain the `AZURE_CONNECTION_STRING` value go to your "Storage Account" and click on "Access Keys". You will also
need to create a container in your storage account before starting the Nx Cloud container.

If you use an external file storage and an external MongoDB instance, you don't have to provision the volume.

{% callout type="note" title="Cache expiration time" %}
See note above about setting a cache expiration time. For Azure blob
storage, [see this guide](https://docs.microsoft.com/en-us/azure/cdn/cdn-manage-expiration-of-blob-content).
{% /callout %}
