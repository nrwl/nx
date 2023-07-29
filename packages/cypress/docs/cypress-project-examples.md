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
You can also run the `cypress-project` generator against API projects like a [Nest API](/packages/nest/generators/application#@nx/nest:application).
If there is a URL to visit then you can test it with Cypress!
{% /callout %}

## Using Cypress with Vite.js

Now, you can generate your Cypress project with Vite.js as the bundler:

```bash
nx g cypress-project --name=my-app-e2e --project=my-app --bundler=vite
```

This generator will pass the `bundler` information (`bundler: 'vite'`) to our `nxE2EPreset`, in your project's `cypress.config.ts` file (eg. `my-app-e2e/cypress.config.ts`).

### Customizing the Vite.js configuration

The `nxE2EPreset` will then use the `bundler` information to generate the correct settings for your Cypress project to use Vite.js. In the background, the way this works is that it's using a custom Vite preprocessor for your files, that's called on the `file:preprocessor` event. If you want to customize this behaviour, you can do so like this in your project's `cypress.config.ts` file:

```ts
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

const config = nxE2EPreset(__filename, { bundler: 'vite' });
export default defineConfig({
  e2e: {
    ...config,
     setupNodeEvents(on, config): {
      config.setupNodeEvents(on);
      // Your settings here
    }
  },
});
```
