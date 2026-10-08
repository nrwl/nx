#### Move custom executor hashers to target inputs

Custom hashers are deprecated in Nx 24 and will be removed in Nx 25.
A custom hasher is the `hasher` property of an executor in `executors.json`, pointing at a module that computes the task hash in code.
Target `inputs` replace them.

This migration finds every local plugin in the workspace whose `executors.json` (or `builders.json`) declares a `hasher`.
It doesn't edit any files.
When it finds one, it lists the executor, the hasher module, and the `executors.json` file in the migration's next steps.
It also lists files and executor entries it can't read, so you can check those by hand.
Under `nx migrate` with an AI agent, the agent reads each hasher and writes `inputs` that hash the same things.
A target that declares its own `inputs` doesn't inherit them from `targetDefaults`, so the agent checks every target that uses the executor and adds the inputs where they're missing.
It removes the `hasher` only once every one of those targets is covered.
If something the hasher hashes can't be expressed as an input, the agent leaves the hasher in place and tells you why.

Packages installed in `node_modules` aren't scanned.
If a third-party plugin you use declares a hasher, Nx warns about it when it hashes one of its tasks.

#### Sample code changes

Given a local plugin whose `echo` executor hashes the project, its dependencies, and the `API_URL` environment variable:

##### Before

```json title="tools/my-plugin/executors.json"
{
  "executors": {
    "echo": {
      "implementation": "./src/executors/echo/executor",
      "hasher": "./src/executors/echo/hasher",
      "schema": "./src/executors/echo/schema.json"
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@acme/my-plugin:echo": {
      "inputs": ["default", "^default", { "env": "API_URL" }]
    }
  }
}
```

```json title="tools/my-plugin/executors.json"
{
  "executors": {
    "echo": {
      "implementation": "./src/executors/echo/executor",
      "schema": "./src/executors/echo/schema.json"
    }
  }
}
```

#### Reference

- [Replace a custom hasher with inputs](https://nx.dev/docs/kb/local-executors#replace-a-custom-hasher-with-inputs)
- [Inputs reference](https://nx.dev/docs/reference/inputs)
