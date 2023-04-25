# Set Up Nx Cloud on Kubernetes

A lot of organizations deploy Nx Cloud to Kubernetes.

This guide references the [nx-cloud-helm](https://github.com/nrwl/nx-cloud-helm) repo which contains:

- Nx Cloud Helm Chart
- Instructions on how to install Nx Cloud using Helm
- Instructions on how to install Nx Cloud using kubectl. See [here](https://github.com/nrwl/nx-cloud-helm/blob/main/no-helm/README.md).

## Deployments on AWS/EKS

If you're deploying on EKS, check out our [AWS Guide](https://github.com/nrwl/nx-cloud-helm/blob/main/aws-guide/AWS-GUIDE.md). Otherwise, continue reading below.

## Installing Using Helm

Steps:

1. Deploy MongoDB Kubernetes Operator
   - using helm: https://github.com/mongodb/helm-charts
   - using kubectl: https://github.com/mongodb/mongodb-kubernetes-operator
2. Create a mongodb replica set
3. Create a secret
4. Install Nx Cloud using helm

### Step 1: Deploy MongoDB Kubernetes Operator

If you are using a hosted MongoDB installation (e.g., Mongo Atlas or CosmosSB, or you are running one yourself), you can
skip steps 1 and 2.

```
> helm repo add mongodb https://mongodb.github.io/helm-charts
> helm install community-operator mongodb/community-operator
```

### Step 2: Deploy a MongoDB replica set

```
> kubectl apply -f examples/mongodb.yml
```

This will create a secret. You can get the value of the secret as follows:

> kubectl get secret cloud-mongodb-nrwl-api-admin-user -o go-template='{{range $k,$v := .data}}{{"### "}}{{$k}}{{"n"}}{{$v|base64decode}}{{"nn"}}{{end}}'

You might need to wait a bit for the Pods to be created before this secret will be available.

The output of the command can be a bit confusing (you are only interested in the second part of the output). The default connection string for the Mongo Community Operator will look like
this: `mongodb+srv://admin-user:DB_PASSWORD@cloud-mongodb-svc.default.svc.cluster.local/nrwl-api?replicaSet=cloud-mongodb&ssl=false`
. You should be able to use this value.

Take this connection string and paste it into your `examples/secret.yml`, replacing the placeholder value.

### Step 3: Create a secret

With the values updated, create a secret by running `kubectl apply -f examples/secret.yml`

### Step 4: Install Nx Cloud using helm

```
> helm repo add nx-cloud https://nrwl.github.io/nx-cloud-helm
> helm install nx-cloud nx-cloud/nx-cloud --values=overrides.yml
```

`examples/overrides` contains the min overrides files. You need to provision:

1. The image tag you want to install
2. `nxCloudAppURL` which is the url used to access ingress from CI and dev machines (
   e.g., `https://nx-cloud.myorg.com`).
3. `secret/name` the name of the secret you created in Step 3.
4. `secret/nxCloudMongoServerEndpoint`, the name of the key from the secret.
   5`secret/adminPassword`, the name of the key from the secret.

If you only applied the secret from Step 3, the only thing you will need to change is `nxCloudAppURL`.

## Cloud Containers

The installation will create the following:

1. nx-cloud-frontend (deployment)
2. nx-cloud-api (deployment)
3. nx-cloud-nx-api (deployment)
4. nx-cloud-file-server (deployment)
5. nx-cloud-aggregator (cron job)

## Ingress, IP, Certificates

You can configure Ingress. For instance, the following will see the ingress class to 'gce', the global static ip name
to 'nx-cloud-ip', and will set a global Google managed certificate.

```yaml
image:
  tag: 'latest'

nxCloudAppURL: 'https://nx-cloud.myorg.com'

ingress:
  class: 'gce'
  globalStaticIpName: 'nx-cloud-ip'
  managedCertificates: 'cloud-cert'

secret:
  name: 'cloud'
  nxCloudMongoServerEndpoint: 'NX_CLOUD_MONGO_SERVER_ENDPOINT'
  adminPassword: 'ADMIN_PASSWORD'
```

This configuration will look different for you. You will have a different global static ip and your cert name will also
be different. If you are interested in creating the two using GKE, check out the following links:

- [Reserving a static external IP address](https://cloud.google.com/compute/docs/ip-addresses/reserve-static-external-ip-address)
- [Using Google-managed SSL certificates](https://cloud.google.com/kubernetes-engine/docs/how-to/managed-certs)

If you aren't using GKE, `ingress.class` will also be different. For example, see [our example config for AWS](https://github.com/nrwl/nx-cloud-helm/blob/main/aws-guide/helm-values.yml#L7) or check out the AWS Load Balancer set-up section [here for AWS set-up instructions.](https://github.com/nrwl/nx-cloud-helm/blob/main/aws-guide/AWS-GUIDE.md#3-install-a-load-balancer)

If you need to have a detailed Ingress configuration, you can tell the package to skip defining ingress:

```yaml
image:
  tag: 'latest'

nxCloudAppURL: 'https://nx-cloud.myorg.com'

ingress:
  skip: true
```

⤵️ and then define it yourself

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nx-cloud-ingress
  annotations:

  labels:
    app: nx-cloud
spec:
  rules:
    - http:
        paths:
          # define the next /file section only if you use the built-in file server
          - path: /file
            pathType: Prefix
            backend:
              service:
                name: nx-cloud-file-server-service
                port:
                  number: 5000
          - path: /nx-cloud
            pathType: Prefix
            backend:
              service:
                name: nx-cloud-nx-api-service
                port:
                  number: 4203
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: nx-cloud-nrwl-api-service
                port:
                  number: 4000
          - path: /graphql
            pathType: Prefix
            backend:
              service:
                name: nx-cloud-nrwl-api-service
                port:
                  number: 4000
          - path: /auth
            pathType: Prefix
            backend:
              service:
                name: nx-cloud-nrwl-api-service
                port:
                  number: 4000
          - path: /download
            pathType: Prefix
            backend:
              service:
                name: nx-cloud-nrwl-api-service
                port:
                  number: 4000
                             - path: /download
          - pathType: Prefix
            backend:
               service:
                  name: nx-cloud-frontend-service
                  port:
                     number: 8080
```

### Step 5: Connect Your Workspace

Run `NX_CLOUD_API=https://nx-cloud.myorg.com nx connect`. Click on the link to connect the workspace
to your admin account.

## Variations

### External File Storage

If you use AWS or Azure, you can configure Nx Cloud to store cached artifacts on S3 or Azure Blob. In this case, you
won't need the PVC or the file-server container. S3 and Azure Blob also tend to be faster.

For S3 buckets, see the [AWS Guide](https://github.com/nrwl/nx-cloud-helm/blob/main/aws-guide/AWS-GUIDE.md#6-external-s3-access)

For Azure:

```yaml
image:
  tag: 'latest'

nxCloudAppURL: 'https://nx-cloud.myorg.com'

azure:
  enabled: true
  container: 'nx-cloud'

secret:
  name: 'cloudsecret'
  nxCloudMongoServerEndpoint: 'NX_CLOUD_MONGO_SERVER_ENDPOINT'
  adminPassword: 'ADMIN_PASSWORD'
  azureConnectionString: 'AZURE_CONNECTION_STRING'
```

Note that the secret for setting up Azure must contain `AZURE_CONNECTION_STRING`.

### GitHub Auth

To use GitHub for user authentication, you can use the following configuration:

```yaml
image:
  tag: 'latest'

nxCloudAppURL: 'https://nx-cloud.myorg.com'

github:
  auth:
    enabled: true

secret:
  name: 'cloudsecret'
  nxCloudMongoServerEndpoint: 'NX_CLOUD_MONGO_SERVER_ENDPOINT'
  githubAuthClientId: 'GITHUB_AUTH_CLIENT_ID'
  githubAuthClientSecret: 'GITHUB_AUTH_CLIENT_SECRET'
```

Note that the secret must contain `GITHUB_AUTH_CLIENT_ID` and `GITHUB_AUTH_CLIENT_SECRET`.
Read [here](https://nx.dev/nx-cloud/private-cloud/auth-github) on how to get those values.

### GitHub Integration

To enable the GitHub PR integration, you can use the following configuration:

```yaml
image:
  tag: 'latest'

nxCloudAppURL: 'https://nx-cloud.myorg.com'

github:
  pr:
    enabled: true
    # apiUrl: '' uncomment when using github enterprise

secret:
  name: 'cloudsecret'
  nxCloudMongoServerEndpoint: 'NX_CLOUD_MONGO_SERVER_ENDPOINT'
  githubWebhookSecret: 'GITHUB_WEBHOOK_SECRET'
  githubAuthToken: 'GITHUB_AUTH_TOKEN'
```

Note that the secret must contain `GITHUB_WEBHOOK_SECRET` and `GITHUB_AUTH_TOKEN`.
Read [here](https://nx.dev/nx-cloud/private-cloud/github) on how to get those values.

## More Information

You can find more information about Nx Cloud and running it on
prem [here](https://nx.dev/nx-cloud/private-cloud/get-started).
