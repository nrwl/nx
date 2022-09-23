Adding Cypress to an existing application requires two options. The name of the e2e app to create and what project that e2e app is for.

```bash
nx g cypress-project --name=my-app-e2e --project=my-app
```

When providing `--project` option, the generator will look for the `serve` target in that given project. This allows the [cypress executor](/packages/cypress/executors/cypress) to spin up the project and start the cypress runner.

If you prefer to not have the project served automatically, you can provide a `--base-url` argument in place of `--project`

```bash
nx g cypress-project --name=my-app-e2e --base-url=http://localhost:1234
```

{% callout type="note" title="What about API Projects?" %}
You can also run the `cypress-project` generator against API projects like a [Nest API](/packages/nest/generators/application#@nrwl/nest:application).
If there is a URL to visit then you can test it with Cypress!
{% /callout %}
