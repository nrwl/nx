# Running a Standalone Container

Nx Cloud can be deployed in two ways:

- [Using Kubernetes](https://github.com/nrwl/nx-cloud-helm) (several containers working together)
- Using a single standalone container (NOT RECOMMENDED)

The flags and the capabilities are the same between the two, but the Kubernetes setup is more robust and better
documented. This document covers the latter version.

**Nx Cloud consists of 3 parts:**

1. The stateless Nx Cloud service
2. MongoDB database
3. File server

By default, the container created by the `nxprivatecloud/single-image` image will create two of them: the stateless Nx Cloud service, and the file server. Using a single container is the easiest way to set it up, but it isn't the most robust way to run Nx Cloud.

You will then need to host the database separately:

- Either by using a service such as Mongo Atlas
- Or running it yourself. For that, we created the `nxprivatecloud/nx-cloud-mongo` image.

The instructions will go through running the embedded file server, and then, at the end, will talk about hosting your cached artefacts on an external service, such as Amazon S3.

## Running Nx Cloud

### Step 1: Pull the Image

```shell
> docker pull nxprivatecloud/single-image
```

To update the version of Nx Cloud, pull the new version of the image and run it against the same mount (see
below).

### Step 2: Create a Container

Depending on how your infrastructure is set up, you can either run Nx Cloud using HTTPS or HTTP. If you have a
proxy/load-balancer in front of Nx Cloud, you will likely want to run Nx Cloud using HTTP (the
proxy/load-balancer will handle TLS). Otherwise, you will likely want to run Nx Cloud using HTTPS.

**To create a container:**

1. You will need to create a directory on the host machine where data will be stored. (_This is not necessary if you are
   running the file server separately. See below._)
2. You will need to know the URL that the Nx Cloud installation can be accessed by (see `NX_CLOUD_APP_URL` below).
   - `NX_CLOUD_APP_URL` should be accessible from your CI and dev machines.
   - `NX_CLOUD_APP_URL` can be set with an HTTP or HTTPS url. In a case where you are using a proxy/load-balancer, you
     can still put HTTPS (the url will be resolved by the proxy before hitting the app).
   - `NX_CLOUD_APP_URL` is likely to be an external IP/domain of the load balancer.
3. If you are running Nx Cloud using HTTPS, you need to generate or obtain an SSL certificate and an SSL private
   key.

**Once you obtain all the needed information, you can run the following:**

**Using HTTPS**

```shell
> docker create --name cloud \

        -p 443:8081 \
        -e CERT_KEY="$(cat ./tools/certs/key.pem)" \
        -e CERT="$(cat ./tools/certs/cert.pem)" \
        -e NX_CLOUD_APP_URL="https://cloud.myorg.com" \
        -e ADMIN_PASSWORD=admin \
        -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

**Using HTTP (no proxy)**

```shell
> docker create --name cloud \

        -p 80:8081 \
        -e NX_CLOUD_APP_URL="http://cloud.myorg.com" \
        -e ADMIN_PASSWORD=admin \
        -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

**Using HTTPS via proxy**

```shell
> docker create --name cloud \
        -p 80:8081 \
        -e NX_CLOUD_APP_URL="https://cloud.myorg.com" \
        -e ADMIN_PASSWORD=admin \
        -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

**Let's see what those options mean:**

- `443:8081` maps the internal port 8081 to 443, so it can be accessed in the browser without specifying the port. 80:
  8081 works the same way when you use HTTP instead of HTTPS.
- `CERT_KEY` and `CERT` contain the values of private key and cert. The file extensions of the cert and key files can be
  different, but as long as they are in the PEM format (which is the case if you use, for instance, OpenSSL), the
  command will work.
- `NX_CLOUD_APP_URL` is the URL the cloud can be accessed by (e.g., `https://nxcloud.privateurl.com`). **Important:
  Unless you are experimenting, it won't be localhost. It has to be the URL that your CI and your developer machine can
  reach. Also note, there is no trailing slash in the URL.**
- `ADMIN_PASSWORD` contains the password of the admin user. The admin user is created the first time you run cloud, you
  can remove this env variable after that. Instead of an admin password, you can also
  follow [the instructions here](/nx-cloud/private-cloud/auth-github) to set up GitHub auth.
- `-v /data/private-cloud:/data` sets up the volume where the data (the cached artefacts) is stored. `/data/private-cloud` refers to a folder
  on your machine, `/data` is the shareable folder from the Docker image.

### Step 3: Run the Container

Once you create the container, you can start it using:

```shell
> docker start cloud
```

Imagine `NX_CLOUD_APP_URL` is set to `https://nxcloud.privateurl.com`.

Now, go to https://nxcloud.privateurl.com to see cloud running. You can log into the account
using `admin/ADMIN_PASSWORD`.

### Step 4: Connect Your Workspace

Run `NX_CLOUD_API=https://nxcloud.privateurl.com` nx connect. Click on the link to connect the workspace
to your admin account.

### Optional step 5: set up GitHub auth

Follow the [instructions here](/nx-cloud/private-cloud/auth-github) to set up GitHub OAuth authentication so you can
invite other members in your team to the workspace.

### Optional step 6: set up GitHub Pull Request integration

You can [optionally configure Nx Cloud](/nx-cloud/set-up/github) to post build stats directly on your GitHub
pull requests.

### Optional step 7: Setting Up Proxy

If your container cannot access `api.nrwl.io` directly and has to talk via a proxy, you can
add `-e HTTPS_PROXY="https://myproxy.myorg.com"` to the container creation command.

## Running the Mongo Database

Nx Cloud uses MongoDB to store its metadata. You will need to provision the `NX_CLOUD_MONGO_SERVER_ENDPOINT` env variable when
creating a container, like so:

```shell
-e NX_CLOUD_MONGO_SERVER_ENDPOINT="mongodb://domain-with-mongo:27017/nrwl-api"
```

By default, Nx Cloud requires Mongo 4.2+. If you are using an older version of Mongo (for instance, if you are using
Cosmos DB), please add

```shell
-e NX_CLOUD_USE_MONGO42=false
```

### Deploy Mongo on your Kubernetes engine or Docker VM

See [here](https://github.com/nrwl/nx-cloud-helm/blob/main/MONGO-OPERATOR-GUIDE.md) for a full guide on running Mongo yourself.

### Using CosmosDB

If you are deploying to Azure, you might have access to CosmosDB. See here for more information.

### Using Mongo Atlas

[Mongo Atlas](https://mongodb.com/) is a great option for deploying MongoDB.

## Using External File Storage

By default, Nx Cloud is going to start a file server and store the cached artifacts in the provided volume. But
you can also configure Nx Cloud to use an external file storage. At the moment, only S3 and Azure Blob are
supported.

### Using S3/Minio

To configure S3 as a file storage, provision the `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET`
env variables when creating the Nx Cloud docker container, like so:

```shell
-e AWS_S3_ACCESS_KEY_ID="SOMEKEY"
-e AWS_S3_SECRET_ACCESS_KEY="SOMESECRETKEY"
-e AWS_S3_BUCKET="nx-cache-bucket-name"
```

If you are using an accelerated bucket, add: `-e AWS_S3_ACCELERATED=true`

If you are using a local S3 installation (e.g., Minio), you can set the endpoint as follows:

```shell
-e AWS_S3_ENDPOINT="https://local-installation.myorg.com"
-e AWS_S3_ACCESS_KEY_ID="SOMEKEY"
-e AWS_S3_SECRET_ACCESS_KEY="SOMESECRETKEY"
-e AWS_S3_BUCKET="nx-cache-bucket-name"
```

{% callout type="note" title="On cache item expiration time" %}
Remember to
set [a cache item expiration time](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html)
. The default is currently 4 weeks. If you would like to keep items for longer, for example for 8 weeks, please remember
to set the `NX_CACHE_EXPIRATION_PERIOD_IN_DAYS=56` env variable as well, so the container knows when to expire the Mongo
cache entries as well.
{% /callout %}

### Using Azure

To configure Azure Blob as a file storage, provision the `AZURE_CONNECTION_STRING`, `AZURE_CONTAINER` env variables when
creating the Nx Cloud docker container, like so:

```shell
-e AZURE_CONNECTION_STRING="SOME-CONNECTION-STRING"
-e AZURE_CONTAINER="files"
```

To obtain the `AZURE_CONNECTION_STRING` value go to your "Storage Account" and click on "Access Keys". You will also
need to create a container in your storage account before starting the Nx Cloud container.

If you use an external file storage solution, you don't have to provision the volume.

{% callout type="note" title="Cache expiration time" %}
See note above about setting a cache expiration time. For Azure blob
storage, [see this guide](https://docs.microsoft.com/en-us/azure/cdn/cdn-manage-expiration-of-blob-content).
{% /callout %}

## Configure Memory Limits

By default, the Nx Cloud container is configured to run on an instance with 8GB of RAM.

If you have a container with 4GB of RAM, you can decrease the memory limits by setting the following env variables:

- `NX_CLOUD_FILE_SERVER_MEMORY_LIMIT=500`
- `NX_CLOUD_API_MEMORY_LIMIT=800`

Example:

```shell
> docker create --name cloud \
    -p 80:8081 \
    -e NX_CLOUD_APP_URL="https://cloud.myorg.com" \
    -e ADMIN_PASSWORD=admin \
    -e NX_CLOUD_FILE_SERVER_MEMORY_LIMIT=500 \
    -e NX_CLOUD_API_MEMORY_LIMIT=800 \
    -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

The right amount of RAM depends heavily on how you run Nx Cloud.

- The `NX_CLOUD_FILE_SERVER_MEMORY_LIMIT` value is only relevant if you use the built-in file server.

For instance, if you use S3 to store the cached artifacts, even 2GB might be sufficient. You can set the following limit:

- `NX_CLOUD_API_MEMORY_LIMIT=800`

If you run everything in the Nx Cloud container, then 5GB is much preferred.

## Configure Artifact Expiration When Using Built-in File Server

By default, the Nx Cloud container is going to remove cached artifacts after two weeks. You can change it by setting `NX_CACHE_EXPIRATION_PERIOD_IN_DAYS` when starting the container.

Example:

```shell
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

## Migration guide from `nxprivatecloud/nxcloud` to `nxprivatecloud/single-image`

The old version of our Docker image, `nxprivatecloud/nxcloud`, is no longer being maintained. This section will explain how to migrate to the new standalone image, `nxprivatecloud/single-image`.

Unlike `nxprivatecloud/nx-cloud`, the `nxprivatecloud/single-image` container does not come with MongoDB included. This makes for a much simpler image, based on Alpine (and not Ubuntu), with less chances for security vulnerabilities. However, it does require you to connect to an external Mongo instance. Below we'll cover the two possible migration scenarios.

#### You are connecting to an external Mongo instance

If you are currently connecting to an external Mongo instance, then migrating to the new image is as simple as switching the Docker tag from `nxprivatecloud/nxcloud` to `nxprivatecloud/single-image`. All the other configuration options can stay the same.

#### You are running Mongo inside the Docker image

If you are currently relying on the image to host Mongo, we will need to move that to an external instance.

##### Starting fresh with a dedicated Mongo instance

1. We recommend setting up a dedicated Mongo host, on Atlas [as described above](#using-mongo-atlas). This means you will lose you current workspace set-up, but it is the easiest migration path and the most maintanable one.
   1. To do this, get the connection string from Mongo Atlas
   2. And configure the image with it: `-e NX_CLOUD_MONGO_SERVER_ENDPOINT="mongodb://domain-with-mongo:27017/nrwl-api"`
   3. That's it!
2. If you cannot use Atlas or Azure CosmosDB within your org, then you'll need to run our dedidcated Mongo Docker image. Instructions for this approach are described below.

##### Migrating your data to a separate self-hosted Mongo instance

1. When running the image, you are probably mapping to the host volume like this `-v /data/private-cloud:/data:Z`
2. That data folder is where the image stores all its persistent data that needs exist between restarts or updates of the image. Inside it you'll find:

   1. In the old image (`nxprivatecloud/nx-cloud`):
      1. `/data/file-server`: if you are using the built-in file-server, this is where you'll find all the cached artefacts. If you are using an external S3 buckets this folder won't exist.
      2. `/data/mongo`: this is where Mongo stores all its files.
   2. In the new image (`nxprivatecloud/single-image`):
      1. `/data/file-server` (if using the built-in file-server, otherwise you don't need to map anything)

3. Copy the contents of `/data/mongo` folder from the host where you previously used to run Mongo, to the new host where you'll run the dedicated Mongo image
4. Run Mongo as described [here](https://github.com/nrwl/nx-cloud-helm/blob/main/MONGO-OPERATOR-GUIDE.md)
   1. In there, you'll find instructions to map the `$PWD/mongo-data:/data/db` folder to your host
   2. Copy the data from Step 1. above into the new mapped folder above.
5. Get the connection string for the above image
6. Start your `nxprivatecloud/single-image` container with the `-e NX_CLOUD_MONGO_SERVER_ENDPOINT="mongodb://52.201.253.213:27017/?authSource=admin&directConnection=true"` env var
7. You can remove the `/data/mongo` folder from the `single-image` mapping (you will need to keep `/data/file-server` if you not using an external S3 bucket)
