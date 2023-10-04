# Angular Standalone Tutorial - Part 2: Project Graph

Run the command: `npx nx graph`. A browser should open up with the following contents:

{% graph height="450px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "cart",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "e2e",
      "type": "e2e",
      "data": {
        "tags": []
      }
    },
    {
      "name": "store",
      "type": "app",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "cart": [],
    "shared-ui": [],
    "e2e": [{ "source": "e2e", "target": "store", "type": "implicit" }],
    "store": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

Nx creates the graph based on the source code. The projects are not linked in this diagram because we haven't actually finished our application. Once we use the shared components in another project, Nx will create the dependency in the graph. Let's do that now.

### Set Up the Router

Configure the routes:

```javascript {% fileName="src/app/app.module.ts" %}
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { SharedUiModule } from '@store/shared/ui';

import { AppComponent } from './app.component';
import { NxWelcomeComponent } from './nx-welcome.component';
import { ShopComponent } from './shop/shop.component';

@NgModule({
  declarations: [AppComponent, NxWelcomeComponent, ShopComponent],
  imports: [
    BrowserModule,
    SharedUiModule,
    RouterModule.forRoot([
      {
        path: 'cart',
        loadChildren: () => import('@store/cart').then((m) => m.CartModule),
      },
      {
        path: '**',
        component: ShopComponent,
      },
    ]),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

```javascript {% fileName="src/app/app.component.html" %}
<router-outlet></router-outlet>
```

{% callout type="note" title="Typescript Paths" %}
When a library is created, Nx adds a new Typescript path to the `tsconfig.base.json` file. The running Typescript server process inside of your editor sometimes doesn't pick up these changes and you have to restart the server to remove inline errors on your import statements. This can be done in VS Code from the command palette when viewing a typescript file (Command-Shift-P) "Typescript: Restart TS server"
{% /callout %}

### `shared-ui`

Run the `@nx/angular:component` generator with the command:

```{% command="npx nx g @nx/angular:component banner --project=shared-ui --export" path="~/store" %}

>  NX  Generating @nx/angular:component

CREATE shared/ui/src/lib/banner/banner.component.css
CREATE shared/ui/src/lib/banner/banner.component.html
CREATE shared/ui/src/lib/banner/banner.component.spec.ts
CREATE shared/ui/src/lib/banner/banner.component.ts
UPDATE shared/ui/src/lib/shared-ui.module.ts
UPDATE shared/ui/src/index.ts
```

Then create a simple `Banner` component in the generated file:

```javascript {% fileName="shared/ui/src/lib/banner/banner.component.ts" %}
import { Component, Input } from '@angular/core';

@Component({
  selector: 'store-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.css'],
})
export class BannerComponent {
  @Input() text = '';
}
```

```javascript {% fileName="shared/ui/src/lib/banner/banner.component.html" %}
<header>{{ text }}</header>
```

### `cart`

Create a cart-route component:

```{% command="npx nx g @nx/angular:component cart-route --project=cart" path="~/store" %}

>  NX  Generating @nx/angular:component

CREATE cart/src/lib/cart-route/cart-route.component.css
CREATE cart/src/lib/cart-route/cart-route.component.html
CREATE cart/src/lib/cart-route/cart-route.component.spec.ts
CREATE cart/src/lib/cart-route/cart-route.component.ts
UPDATE cart/src/lib/cart.module.ts
```

Add the `Banner` component to the cart route and link back to the main page:

```javascript {% fileName="cart/src/lib/cart.module.ts" %}
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartRouteComponent } from './cart-route/cart-route.component';
import { SharedUiModule } from '@store/shared/ui';

@NgModule({
  declarations: [CartRouteComponent],
  imports: [
    CommonModule,
    SharedUiModule,
    RouterModule.forChild([
      {
        path: '',
        component: CartRouteComponent,
      },
    ]),
  ],
})
export class CartModule {}
```

```javascript {% fileName="cart/src/lib/cart-route/cart-route.component.html" %}
<store-banner text="Welcome to the cart." ></store-banner>
<a routerLink="/">Continue Shopping</a>
```

### `store`

Update the `shop` component to use the `Banner` component and link to the cart.

```javascript {% fileName="src/app/shop/shop.component.html" %}
<store-banner text="Here is a list of products to buy..." ></store-banner>
<a routerLink="/cart">View Cart</a>
```

Now run `npx nx graph` again:

{% graph height="450px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "cart",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "e2e",
      "type": "e2e",
      "data": {
        "tags": []
      }
    },
    {
      "name": "store",
      "type": "app",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "cart": [{ "source": "cart", "target": "shared-ui", "type": "static" }],
    "shared-ui": [],
    "e2e": [{ "source": "e2e", "target": "store", "type": "implicit" }],
    "store": [
      { "source": "store", "target": "cart", "type": "dynamic" },
      { "source": "store", "target": "shared-ui", "type": "static" }
    ]
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

Your graph now shows the dependency lines we expected.

The Project Graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Task Pipelines](/angular-standalone-tutorial/4-task-pipelines).

## What's Next

- Continue to [3: Task Running](/angular-standalone-tutorial/3-task-running)
