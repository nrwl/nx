#### Change the Data Persistence Operator Imports from `@nx/angular` to `@ngrx/router-store/data-persistence`

The data persistence operators (`fetch`, `navigation`, `optimisticUpdate`, and `pessimisticUpdate`) have been deprecated for a while and are now removed from the `@nx/angular` package. This migration automatically updates your import statements to use the `@ngrx/router-store/data-persistence` module and adds `@ngrx/router-store` to your dependencies if needed.

#### Examples

If you import only data persistence operators from `@nx/angular`, the migration will update the import path to `@ngrx/router-store/data-persistence`.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/app1/src/app/users/users.effects.ts" highlightLines=[2] %}
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { fetch } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="apps/app1/src/app/users/users.effects.ts" highlightLines=[2] %}
import { Injectable } from '@angular/core';
import { fetch } from '@ngrx/router-store/data-persistence';

@Injectable()
export class UsersEffects {
  // ...
}
```

{% /tab %}
{% /tabs %}

If you import multiple data persistence operators from `@nx/angular`, the migration will update the import path for all of them.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/app1/src/app/users/users.effects.ts" highlightLines=[2] %}
import { Injectable } from '@angular/core';
import { fetch, navigation } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="apps/app1/src/app/users/users.effects.ts" highlightLines=[2] %}
import { Injectable } from '@angular/core';
import { fetch, navigation } from '@ngrx/router-store/data-persistence';

@Injectable()
export class UsersEffects {
  // ...
}
```

{% /tab %}

{% /tab %}
{% /tabs %}

If your imports mix data persistence operators with other utilities from `@nx/angular`, the migration will split them into separate import statements.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/app1/src/app/users/users.effects.ts" highlightLines=[2] %}
import { Injectable } from '@angular/core';
import { fetch, someExtraUtility, navigation } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="apps/app1/src/app/users/users.effects.ts" highlightLines=[2,3] %}
import { Injectable } from '@angular/core';
import { fetch, navigation } from '@ngrx/router-store/data-persistence';
import { someExtraUtility } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

{% /tab %}
{% /tabs %}

If you don't already have `@ngrx/router-store` in your dependencies, the migration will add it to your package.json.

{% tabs %}
{% tab label="Before" %}

```jsonc {% fileName="package.json" %}
{
  "dependencies": {
    "@nx/angular": "^21.0.0",
    "@ngrx/store": "^19.1.0",
    "@ngrx/effects": "^19.1.0"
    // ...
  }
}
```

{% /tab %}

{% tab label="After" %}

```jsonc {% fileName="package.json" highlightLines=[6] %}
{
  "dependencies": {
    "@nx/angular": "^21.0.0",
    "@ngrx/store": "^19.1.0",
    "@ngrx/effects": "^19.1.0",
    "@ngrx/router-store": "^19.1.0"
    // ...
  }
}
```

{% /tab %}
{% /tabs %}
