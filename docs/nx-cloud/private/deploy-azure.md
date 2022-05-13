# Deploying Nx Private Cloud to Azure

You can easily deploy Nx Private Cloud to Azure.

## Container Setup

First, create a container configuration using the following image: `nxprivatecloud/nxcloud:latest`

Second, create a mount point `-v /data/private-cloud:/data`

Third, provision the following env variables

```json
[
  {
    "name": "ADMIN_PASSWORD",
    "value": "admin-password"
  },
  {
    "name": "GITHUB_API_URL",
    "value": "https://api.github.com"
  },
  {
    "name": "GITHUB_AUTH_TOKEN",
    "value": "your-github-auth-token"
  },
  {
    "name": "GITHUB_WEBHOOK_SECRET",
    "value": "your-github-webhoook-secret"
  },
  {
    "name": "NX_CLOUD_APP_URL",
    "value": "url-accessible-from-ci-and-dev-machines"
  },
  {
    "name": "NX_CLOUD_MODE",
    "value": "private-community"
  }
]
```

All env variables prefixed with `GITHUB` are required for the GitHub integration. If you don’t use GitHub, you don’t have to set them.

To test that everything works, open `NX_CLOUD_APP_URL` in the browser and log in using the user name “admin” and the password provisioned above.

## Using Azure Blob Storage

If you want to use AzureBlob for storing and delivering cached artifacts, add the following env variables:

```json
[
  {
    "name": "AZURE_CONNECTION_STRING",
    "value": "your-azure-connection-string"
  },
  {
    "name": "AZURE_CONTAINER",
    "value": "your-azure-container"
  }
]
```

Using this configuration, the metadata will be stored in the volume and the file artifacts will be stored in Azure Blob Storage.

We highly recommend using Azure Blob Storage for large workspaces.

## Using Azure Blob Storage and CosmosDB

If you want to use AzureBlog for storing and delivering cached artifacts and CosmosDB for storing metadata, add the following env variables:

```json
[
  {
    "name": "NX_CLOUD_MONGO_SERVER_ENDPOINT",
    "value": "your-cosmos-db-url"
  },
  {
    "name": "NX_CLOUD_USE_MONGO42",
    "value": "false"
  },
  {
    "name": "AZURE_CONNECTION_STRING",
    "value": "your-azure-connection-string"
  },
  {
    "name": "AZURE_CONTAINER",
    "value": "your-azure-container"
  }
]
```

Using this configuration, task metadata will be stored in CosmosDB and file artifacts will be stored in Azure Blob Storage. You don’t need a mount point for your container.
