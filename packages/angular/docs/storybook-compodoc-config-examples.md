This generator will configure Compodoc for your Angular project that is already configured with Storybook.

You can configure Compodoc for just one project, or for all the Angular projects with Storybook in your workspace, using the following commands:

{% tabs %}
{% tab label="Compodoc for one project" %}

Configure Compodoc for an Angular project with Storybook nameds `my-app`:

```bash
nx g @nrwl/angular:storybook-compodoc-config --name=my-app
```

{% /tab %}

{% tab label="Compodoc for all projects" %}

Congifure compodoc for Storybook for all Angular projects with Storybook:

```bash
nx g @nrwl/angular:storybook-compodoc-config --all
```

{% /tab %}

{% /tabs %}

You can read more about Compodoc and Storybook in the [Set up Compodoc for Storybook on Nx documentation page](/storybook/angular-storybook-compodoc.md).
