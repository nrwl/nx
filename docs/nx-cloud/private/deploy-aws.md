# Deploying Nx Private Cloud to AWS
You can easily deploy your Nx Private Cloud instance to AWS.

## Using ECS 
First, create a container configuration using the following image: nxprivatecloud/nxcloud:latest

Second, set up a mount point.

```json
"mountPoints": [
  {
    "readOnly": null,
    "containerPath": "/data",
    "sourceVolume": "data"
  }
],
```

Third, configure the following env variables:

```json
"environment": [
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
    "value": "your-github-webhook-secret"
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

All env variables prefixed with `GITHUB` are required for the Nx Cloud GitHub integration. If you don't use GitHub, you don't need to set them.

To test that everything works, open `NX_CLOUD_APP_URL` in the browser and log in using the username "admin" and the password provisioned above.

For reference, here is an example complete task definition:

```json
{
  "ipcMode": null,
  "executionRoleArn": null,
  "containerDefinitions": [
    {
      "dnsSearchDomains": null,
      "environmentFiles": null,
      "logConfiguration": {
        "logDriver": "awslogs",
        "secretOptions": null,
        "options": {
          "awslogs-group": "/ecs/DeployCloud",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "entryPoint": null,
      "portMappings": [
        {
          "hostPort": 8081,
          "protocol": "tcp",
          "containerPort": 8081
        }
      ],
      "command": null,
      "linuxParameters": null,
      "cpu": 0,
      "environment": [
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
      ],
      "resourceRequirements": null,
      "ulimits": null,
      "dnsServers": null,
      "mountPoints": [
        {
          "readOnly": null,
          "containerPath": "/data",
          "sourceVolume": "data"
        }
      ],
      "workingDirectory": null,
      "secrets": null,
      "dockerSecurityOptions": null,
      "memory": 2000,
      "memoryReservation": null,
      "volumesFrom": [],
      "stopTimeout": null,
      "image": "nxprivatecloud/nxcloud:latest",
      "startTimeout": null,
      "firelensConfiguration": null,
      "dependsOn": null,
      "disableNetworking": null,
      "interactive": null,
      "healthCheck": null,
      "essential": true,
      "links": null,
      "hostname": null,
      "extraHosts": null,
      "pseudoTerminal": null,
      "user": null,
      "readonlyRootFilesystem": null,
      "dockerLabels": null,
      "systemControls": null,
      "privileged": null,
      "name": "PrivateCloud"
    }
  ],
  "placementConstraints": [],
  "memory": null,
  "taskRoleArn": null,
  "compatibilities": [
    "EC2"
  ],
  "taskDefinitionArn": "your-task-definition-arn",
  "family": "deploy-nx-cloud",
  "requiresAttributes": [
    {
      "targetId": null,
      "targetType": null,
      "value": null,
      "name": "com.amazonaws.ecs.capability.logging-driver.awslogs"
    },
    {
      "targetId": null,
      "targetType": null,
      "value": null,
      "name": "com.amazonaws.ecs.capability.docker-remote-api.1.19"
    },
    {
      "targetId": null,
      "targetType": null,
      "value": null,
      "name": "ecs.capability.docker-plugin.local"
    },
    {
      "targetId": null,
      "targetType": null,
      "value": null,
      "name": "com.amazonaws.ecs.capability.docker-remote-api.1.25"
    }
  ],
  "pidMode": null,
  "requiresCompatibilities": [
    "EC2"
  ],
  "networkMode": null,
  "cpu": null,
  "status": "ACTIVE",
  "inferenceAccelerators": null,
  "proxyConfiguration": null,
  "volumes": [
    {
      "fsxWindowsFileServerVolumeConfiguration": null,
      "efsVolumeConfiguration": null,
      "name": "data",
      "host": null,
      "dockerVolumeConfiguration": {
        "autoprovision": true,
        "labels": null,
        "scope": "shared",
        "driver": "local",
        "driverOpts": null
      }
    }
  ]
}
```

When using this configuration, the metadata and file artifacts are stored in the `/data` volume.

## Using S3 
If you want to use S3 for storing and delivering cached artifacts, add the following env variables:

```json
"environment": [
  {
    "name": "AWS_S3_ACCESS_KEY_ID",
    "value": "your-access-key-id"
  },
  {
    "name": "AWS_S3_SECRET_ACCESS_KEY",
    "value": "your-secret-access-key"
  },
  {
    "name": "AWS_S3_BUCKET",
    "value": "your-backet-name"
  }
]
```

Using this configuration, the metadata will be stored on the volume and the file artifacts will be stored using S3.

We highly recommend using S3 for large workspaces.
