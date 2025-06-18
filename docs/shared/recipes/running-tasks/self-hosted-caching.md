---
title: 'Self-Host your Remote Cache'
description: 'Learn how to self-host Nx remote caching on AWS S3, Google Cloud, Azure, or shared drives, or build your own cache server for enhanced build performance in your monorepo.'
---

# Self-Host your Remote Cache

Nx offers different ways to enable self-hosted remote caching for your workspace that can be used starting with Nx version 19.8 and higher:

- **Using the official Nx packages** that come with ready-to-use adapters for AWS S3, GCP, Azure, and more.
- **Build your own cache server** by following the Nx Remote Caching OpenAPI spec.

{% callout type="note" title="Free managed remote cache with Nx Cloud" %}

Note, you can get started for free with a **fully managed remote caching powered by Nx Cloud**. It comes with a generous Hobby plan that is enough for most small teams. [Learn more here](/nx-cloud).

If you are an enterprise and **data privacy and security is a concern**, [reach out for an Enterprise trial](/enterprise/trial). It is fully SOC 2 type 1 and 2 compliant and comes with single-tenant, dedicated EU region hosting as well as on-premise.

**Are you an OSS project?** Nx Cloud is free for OSS. [Reach out here](/pricing#oss).

{% /callout %}

## Official Nx Self-Hosted Cache Packages

The official self-hosted cache packages are the easiest migration path if you've been using a community caching solution based on the old custom task runner API in the past. All of the packages are completely free but require an activation key. Getting a key is a fully automated and self-serving process that happens during the package installation.

The following remote cache adapters are available:

- [@nx/s3-cache](/reference/core-api/s3-cache/overview): Cache is self-hosted on an Amazon S3 bucket
- [@nx/gcs-cache](/reference/core-api/gcs-cache/overview): Cache is self-hosted on Google Cloud storage
- [@nx/azure-cache](/reference/core-api/azure-cache/overview): Cache is self-hosted on Azure
- [@nx/shared-fs-cache](/reference/core-api/shared-fs-cache/overview): Cache is self-hosted on a shared file system location

> Why require an activation key? It simply helps us know and support our users. If you prefer not to provide this information, you can also [build your own cache server](#build-your-own-caching-server).

### Migrating From Custom Tasks Runners

You might have used Nx's now deprecated custom task runners API in the following scenarios:

- to implement custom self-hosted caching: going forward, use the official self-hosted packages or alternatively [build your own caching server](#build-your-own-caching-server)
- to inject custom behavior before and after running tasks in Nx: for that purpose, we've built a new API exposing dedicated pre and post hooks.

To learn more about migrating from custom task runners, [please refer to this detailed guide](/deprecated/custom-tasks-runner).

## Build Your Own Caching Server

Starting in Nx version 20.8, you can build your own caching server using the OpenAPI specification provided below. This allows you to create a custom remote cache server that fits your specific needs. The server is responsible for managing all aspects of the remote cache, including storage, retrieval, and authentication.

Implementation is left up to you, but the server must adhere to the OpenAPI specification provided below to ensure compatibility with Nx's caching mechanism. The endpoints described below involve the transfer of tar archives which are sent as binary data. It is important to note that the underlying format of that data is subject to change in future versions of Nx, but the OpenAPI specification should remain stable.

As long as your server adheres to the OpenAPI spec, you can implement it in any programming language or framework of your choice.

### Open API Specification

```json {% fileName="Nx 20.8+" %}
{
  "openapi": "3.0.0",
  "info": {
    "title": "Nx custom remote cache specification.",
    "description": "Nx is an AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.",
    "version": "1.0.0"
  },
  "paths": {
    "/v1/cache/{hash}": {
      "put": {
        "description": "Upload a task output",
        "operationId": "put",
        "security": [
          {
            "bearerToken": []
          }
        ],
        "responses": {
          "202": {
            "description": "Successfully uploaded the output"
          },
          "401": {
            "description": "Missing or invalid authentication token.",
            "content": {
              "text/plain": {
                "schema": {
                  "type": "string",
                  "description": "Error message provided to the Nx CLI user"
                }
              }
            }
          },
          "403": {
            "description": "Access forbidden. (e.g. read-only token used to write)",
            "content": {
              "text/plain": {
                "schema": {
                  "type": "string",
                  "description": "Error message provided to the Nx CLI user"
                }
              }
            }
          },
          "409": {
            "description": "Cannot override an existing record"
          }
        },
        "parameters": [
          {
            "in": "header",
            "description": "The file size in bytes",
            "required": true,
            "schema": {
              "type": "number"
            },
            "name": "Content-Length"
          },
          {
            "name": "hash",
            "description": "The task hash corresponding to the uploaded task output",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/octet-stream": {
              "schema": {
                "type": "string",
                "format": "binary"
              }
            }
          }
        }
      },
      "get": {
        "description": "Download a task output",
        "operationId": "get",
        "security": [
          {
            "bearerToken": []
          }
        ],
        "responses": {
          "200": {
            "description": "Successfully retrieved cache artifact",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary",
                  "description": "An octet stream with the content."
                }
              }
            }
          },
          "403": {
            "description": "Access forbidden",
            "content": {
              "text/plain": {
                "schema": {
                  "type": "string",
                  "description": "Error message provided to the Nx CLI user"
                }
              }
            }
          },
          "404": {
            "description": "The record was not found"
          }
        },
        "parameters": [
          {
            "name": "hash",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerToken": {
        "type": "http",
        "description": "Auth mechanism",
        "scheme": "bearer"
      }
    }
  }
}
```

### Usage Notes

To use your custom caching server, you must set the `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` environment variable. Additionally, the following environment variables also affect the behavior:

- `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`: The authentication token to access the cache server.
- `NODE_TLS_REJECT_UNAUTHORIZED`: Set to `0` to disable TLS certificate validation.

## Why Switch to Nx Cloud

Nx Cloud is much more than just a remote caching solution; it provides a full platform for scaling monorepos on CI. It comes with:

- [fully managed remote caching with Nx Replay](/ci/features/remote-cache)
- [automated distribution of tasks across machines with Nx Agents](/ci/features/distribute-task-execution)
- [automated splitting of tasks (including e2e tests) with Nx Atomizer](/ci/features/split-e2e-tasks)
- [detection and re-running of flaky tasks](/ci/features/flaky-tasks)

{% call-to-action title="Connect to Nx Cloud" icon="nxcloud" description="Enable task distribution and Atomizer" url="/ci/intro/connect-to-nx-cloud" /%}
