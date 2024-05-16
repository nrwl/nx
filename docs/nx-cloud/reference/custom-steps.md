# Creating Custom Steps

While Nx Cloud provides several pre-built steps, you can create custom steps to suit your specific needs. Custom steps are defined by creating a new YAML file.

## Defining a Custom Step

To create a custom step, follow these steps:

1\. **Create a New YAML File**: Create a new YAML file in your `.nx/workflows` directory (e.g., `custom-step.yaml`)

{% callout type="note" title="Custom step file location" %}
Custom steps do not need to be in the `.nx/workflows` directory. However, they must be available on a public GitHub repository. You have a few options for organizing your custom steps:

- **Same Repository as your Nx Workspace**: Ideal for open-source projects where the Nx workspace is publicly accessible.
- **Create a Dedicated Repository**: Create a separate repository to store a collection of custom steps. This is useful for sharing steps across multiple projects or teams, or if your main Nx workspace is not on GitHub or is private.

{% /callout %}

2\. **Define the Step Template**: Below is an example of a custom step definition:

```yaml {% fileName=".nx/workflows/custom-step.yaml" %}
name: 'Custom Step'
description: 'This is a custom step that does XYZ.'
definition:
  using: 'node'
  main: './scripts/custom-script.js'
  post: './scripts/post-custom-script.js'
inputs:
  - name: 'input1'
    description: 'Description for input1'
    default: 'default_value'
    required: true
  - name: 'input2'
    description: 'Description for input2'
    required: false
```

### Explanation of Fields

- **name**:

  - The name of the custom step.

- **description**:

  - A description of what the custom step does.

- **definition**:

  - **using**: The runtime environment. Supported values are `node` and `aggregate`.
    - **node**: If `using` is set to `node`, then only `main` and `post` can be used.
    - **aggregate**: If `using` is set to `aggregate`, then only `steps` can be used.
  - **main**: Path to the main script to run (only if `using` is `node`).
  - **post**: Path to the post script to run (only if `using` is `node`).
    - runs before the agent is cleaned up
  - **steps**: A list of sub-steps to be executed (only if `using` is `aggregate`). Steps follow the same definition as [launch templates](/ci/reference/launch-templates#launch-template-structure).

- **inputs**:
  - **name**: The name of the input.
  - **description**: A description of the input.
  - **default**: Default value for the input.
  - **required**: Whether the input is required.

### Using Inputs in Scripts

If your custom step has inputs, they can be accessed in scripts or JavaScript files using environment variables. Each input is prefixed with `NX_CLOUD_INPUT_`. For example, if you have an input called `input1`, you can access it in a JavaScript file like this:

```javascript
const input1 = process.env.NX_CLOUD_INPUT_input1;
console.log(`The value of input1 is: ${input1}`);
```

### Using Custom Steps in Launch Templates

Once you've defined your custom step, you can use it in your launch templates by referencing the custom step file. Here's an example:

{% callout type="check" title="Custom Step location" %}
When specifying the location for the custom step, you must include a branch or tag (e.g., `main`). Using a direct URL to the repository without a branch or tag will not work.
{% /callout %}

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  custom-template:
    resource-class: 'docker_linux_amd64/medium'
    image: 'ubuntu22.04-node20.11-v7'
    init-steps:
      - name: Custom Step
        uses: 'your-org/your-repo/main/.nx/workflows/custom-steps.yaml'
        env:
          CUSTOM_VAR: 'custom_value'
        inputs:
          input1: 'value1'
          input2: 'value2'
```

{% callout type="note" title="Recommendation on Using Inputs vs. Env" %}
While you can use both `env` and `inputs` to pass values to custom steps, it is recommended to use `inputs` as they offer validation support, whereas `env` does not.
{% /callout %}

### Validating Custom Steps

Just like launch templates, you should validate your custom steps to ensure they are defined correctly. In your CI pipeline, use the `nx-cloud validate` command with the `--step-file` flag to ensure nobody merges in invalid changes to your step:

```shell
nx-cloud validate --workflow-file=./.nx/workflows/custom-steps.yaml --step-file
```

Ensure your custom steps are committed to your source control repository before running the validation.

By defining and organizing custom steps in this way, you can create highly tailored workflows that meet the specific needs of your projects and CI/CD pipelines.
