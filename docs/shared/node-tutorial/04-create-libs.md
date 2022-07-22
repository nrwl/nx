# Node Nx Tutorial - Step 4: Create Libraries

{% youtube
src="https://www.youtube.com/embed/V29I_DHGlB8"
title="Nx.dev Tutorial | Node | Step 4: Create Libraries"
width="100%" /%}

Libraries are not just a way to share code in Nx. They are also useful for factoring out code into small units with a well-defined public API.

## Public API

Every library has an `index.ts` file, which defines its public API. Other applications and libraries should only access what the `index.ts` exports. Everything else in the library is private.

## Controller libraries

To illustrate how useful libraries can be, create a new Auth library with a controller.

Run

```bash
nx g @nrwl/nest:lib auth --controller
```

{% callout type="note" title="--controller" %}
We added the `--controller` flag here to generate a controller along with the library scaffolding.
{% /callout %}

You should see the following:

```treeview
myorg/
├── apps/
│   └── todos/
├── libs/
│   ├── auth/
│   │   ├── jest.config.js
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── lib/
│   │   │       ├── auth.controller.spec.ts
│   │   │       ├── auth.controller.ts
│   │   │       └── auth.module.ts
│   │   ├── tsconfig.json
│   │   ├── tsconfig.lib.json
│   │   └── tsconfig.spec.json
│   └── data/
├── tools/
├── nx.json
├── package.json
├── tsconfig.base.json
└── workspace.json
```

Modify the `libs/auth/src/lib/auth.controller.ts` file like this:

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get()
  auth() {
    return {
      authenticated: true,
    };
  }
}
```

{% callout type="note" title="We keep things simple here" %}
In code destined for production, you would actually have a proper authentication check here.
{% /callout %}

## Use the new library

**Now import `AuthModule` into `apps/todos/src/app/app.module.ts`.**

```typescript
import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TodosService } from './todos/todos.service';
import { AuthModule } from '@myorg/auth';

@Module({
  imports: [AuthModule],
  controllers: [AppController],
  providers: [AppService, TodosService],
})
export class AppModule {}
```

Restart `nx serve todos` then go to http://localhost:3333/auth. You should see `{ authenticated: true }`.

## What's Next

- Continue to [Step 5: Dep graph](/node-tutorial/05-dep-graph)
