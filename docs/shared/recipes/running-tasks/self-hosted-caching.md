---
title: 'Remote Cache'
description: 'Learn how to set up remote cache.'
---

# Remote Cache

There are several ways to set up remote caching with Nx.

{% callout type="announcement" title="Nx Cloud: Managed Remote Cache" %}

Recommended for everyone.

- [Fully managed multi-tier remote caching with Nx Replay](/ci/features/remote-cache)
- [Both secure and fast](/enterprise/security)
- Generous free plan

You'll also get access to advanced CI features:

- [Automated distribution of tasks across machines with Nx Agents](/ci/features/distribute-task-execution)
- [Automated splitting of tasks (including e2e tests) with Nx Atomizer](/ci/features/split-e2e-tasks)
- [Detection and re-running of flaky tasks](/ci/features/flaky-tasks)
- [Self-healing CI and other AI features](/ai)

[Get Started](https://cloud.nx.app)
{% /callout %}

{% callout type="announcement" title="Nx Enterprise" %}

Recommended for large organizations.

Includes everything from Nx Cloud, plus:

- Work hand-in-hand with the Nx team for continual improvement
- Run on the Nx Cloud servers in any region or run fully self-contained, on-prem
- SOC 2 type 1 and 2 compliant and comes with single-tenant, dedicated EU region hosting as well as on-premise

[Reach out for an Enterprise trial](/enterprise/trial)

{% /callout %}

## Self-Hosted Cache

Great for proof of concepts and small teams.

{% callout type="warning" title="Bucket-based caches are vulnerable to poisoning and often prohibited in organizations" %}

CREEP (CVE-2025-36852) is a critical vulnerability in bucket-based self-hosted remote caches that allows anyone with PR access to poison production builds. Many organizations are unaware of this security risk. [Learn more](/blog/creep-vulnerability-build-cache-security)

All packages below (along with other bucket-based remote cache implementations) are listed in the CVE and are not allowed in many organizations.

{% /callout %}

All packages are free but require an activation key. Getting a key is a fully automated, self-service process that happens during package installation.

The following remote cache adapters are available:

- [@nx/s3-cache](/reference/core-api/s3-cache/overview): Cache is self-hosted on an Amazon S3 bucket
- [@nx/gcs-cache](/reference/core-api/gcs-cache/overview): Cache is self-hosted on Google Cloud storage
- [@nx/azure-cache](/reference/core-api/azure-cache/overview): Cache is self-hosted on Azure
- [@nx/shared-fs-cache](/reference/core-api/shared-fs-cache/overview): Cache is self-hosted on a shared file system location

> Why require an activation key? It simply helps us know and support our users. If you prefer not to provide this information, you can also [build your own cache server](#build-your-own-caching-server).

## Build Your Own Caching Server

Starting in Nx version 20.8, you can build your own caching server using the OpenAPI specification below. This allows you to create a custom remote cache server tailored to your specific needs. The server manages all aspects of the remote cache, including storage, retrieval, and authentication.

Implementation is up to you, but the server must adhere to the OpenAPI specification below to ensure compatibility with Nx's caching mechanism. The endpoints transfer tar archives as binary data. Note that while the underlying data format may change in future Nx versions, the OpenAPI specification should remain stable.

You can implement your server in any programming language or framework, as long as it adheres to the OpenAPI spec.

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

To use your custom caching server, set the `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` environment variable. The following environment variables also affect behavior:

- `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`: The authentication token to access the cache server.
- `NODE_TLS_REJECT_UNAUTHORIZED`: Set to `0` to disable TLS certificate validation.

### Migrating From Custom Tasks Runners

You might have used Nx's now-deprecated custom task runners API in these scenarios:

- To implement custom self-hosted caching: use one of the implementations listed above
- To inject custom behavior before and after running tasks: use our new API with dedicated pre and post hooks

To learn more about migrating from custom task runners, [please refer to this detailed guide](/deprecated/custom-tasks-runner).
