# Custom images for Nx Agents

{% callout type="warning" title="Nx Enterprise" %}
Using a custom base image for Nx Agents is a feature of Nx Enterprise plan for Nx Cloud. If you're interested in Nx Enterprise, we'd love to [chat with you about enterprise](/enterprise)
{% /callout %}

Images need to have a base setup in order to run properly with Nx Agents. There are two ways to go about setting up your base image.
It's recommended to extend our base image. If you cannot extend our image, manually configure your image with the required steps.

{% tabs %}
{% tab label="Extend image (recommended)" %}

**Do not** override the `USER`, `WORKDIR` or `ENTRYPOINT` from the base image.

```yaml {% fileName="nx-agent-base-image.dockerfile"}
FROM us-east1-docker.pkg.dev/nxcloudoperations/nx-cloud-enterprise-public/nx-agents-base-images:ubuntu22.04-node20.19-v2 as base

# Add any steps you need such as installing required software
RUN sudo apt-get install....
RUN sudo chmod ....
```

{% /tab %}
{% tab label="Manual setup" %}

> It's required to use Ubuntu as the base

```yaml {% fileName="nx-agent-base-image.dockerfile" %}
FROM ubuntu:22.04 as base

# Create workflow user
RUN groupadd -g 10001 workflows
RUN useradd -m -u 10000 -g 10001 workflows
RUN mkdir /home/workflows/workspace
RUN mkdir -p /home/workflows/.npm-global/lib /home/workflows/.npm-global/bin
RUN mkdir -p /home/workflows/.nvm
RUN chown -R 10000:10001 /home/workflows
ENV PATH=$PATH:/home/workflows/.npm-global/bin

# Docker
COPY --from=docker:24.0.2 /usr/local/bin /usr/local/bin
COPY --from=docker:24.0.2 /usr/local/libexec /usr/local/libexec

USER workflows

WORKDIR /home/workflows/workspace

ENTRYPOINT [ "/home/workflows/executor-binary/nx-cloud-workflow-executor" ]
```

{% /tab %}
{% /tabs %}

## Checklist

1. Image is publicly accessible to the Nx Cloud instance being used.
   - If your image must remain behind a private registry, please contact your DPE to discuss potential solutions.
2. `USER`, `WORKDIR` and `ENTRYPOINT` are not overridden
   - If manually setting they are correctly configured as outlined in the _Manual_ step above.
3. Image is used in a [custom launch template](/ci/reference/launch-templates#launchtemplatestemplatenameimage) via its fully qualified path
