# Angular Monorepo Tutorial - Part 2: Project Graph

Run the command: `npx nx graph`. A browser should open up with the following contents:

![Initial Project Graph](/shared/angular-tutorial/initial-project-graph.png)

This is still different than the design from the start of Part 1:

![Our Workspace Requirements](/shared/angular-tutorial/requirements-diagram.svg)

The Project Graph is derived from the source code of your workspace. Make the following adjustments to your existing projects, so that our Project Graph will match the design:

### `common-ui`

Run the `@nx/angular:component` generator with the command:

```{% command="npx nx g @nx/angular:component banner --project=common-ui --export" path="~/myorg" %}

>  NX  Generating @nx/angular:component

CREATE libs/common-ui/src/lib/banner/banner.component.css
CREATE libs/common-ui/src/lib/banner/banner.component.html
CREATE libs/common-ui/src/lib/banner/banner.component.spec.ts
CREATE libs/common-ui/src/lib/banner/banner.component.ts
UPDATE libs/common-ui/src/lib/common-ui.module.ts
UPDATE libs/common-ui/src/index.ts
```

Then create a simple `Banner` component in the generated file:

```javascript {% fileName="libs/common-ui/src/lib/banner/banner.component.ts" %}
import { Component, Input } from '@angular/core';

@Component({
  selector: 'myorg-banner',
  template: `<header>{{ title }}</header>`,
  styleUrls: ['./banner.component.css'],
})
export class BannerComponent {
  @Input() title = '';
}
```

### `admin`

Add the `Banner` component to the admin app:

```javascript {% fileName="apps/admin/src/app/app.component.ts" %}
import { Component } from '@angular/core';

@Component({
  selector: 'myorg-root',
  template: `
    <myorg-banner title="Welcome to our admin app."> </myorg-banner>
  `,
})
export class AppComponent {}
```

```javascript {% fileName="apps/admin/src/app/app.module.ts" %}
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonUiModule } from '@myorg/common-ui';

import { AppComponent } from './app.component';
import { NxWelcomeComponent } from './nx-welcome.component';

@NgModule({
  declarations: [AppComponent, NxWelcomeComponent],
  imports: [BrowserModule, CommonUiModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

### `products`

Export a `Product` TS interface and some example products:

```javascript {% fileName="libs/products/src/lib/products.ts" %}
export interface Product {
  id: string;
  name: string;
  price: number;
}

export const exampleProducts: Product[] = [
  {
    id: '1',
    name: 'Product 1',
    price: 100,
  },
  {
    id: '2',
    name: 'Product 2',
    price: 200,
  },
];
```

### `store`

Use both the `Banner` component from your `common-ui` lib, and the `exampleProducts` from your `products` lib:

```javascript {% fileName="apps/store/src/app/app.component.ts" %}
import { exampleProducts } from '@myorg/products';
import { Component } from '@angular/core';

@Component({
  selector: 'myorg-root',
  template: `
    <myorg-banner title="Welcome to the store!"> </myorg-banner>
    <ul>
      <li *ngFor="let product of products">
        <strong>{{ product.name }}</strong> Price: {{ product.price }}
      </li>
    </ul>
  `,
})
export class AppComponent {
  products = exampleProducts;
}
```

```javascript {% fileName="apps/store/src/app/app.module.ts" %}
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonUiModule } from '@myorg/common-ui';

import { AppComponent } from './app.component';
import { NxWelcomeComponent } from './nx-welcome.component';

@NgModule({
  declarations: [AppComponent, NxWelcomeComponent],
  imports: [BrowserModule, CommonUiModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

Now run `npx nx graph` again:

{% side-by-side %}
![Matching Graph](/shared/angular-tutorial/matching-graph.png)

![Our Workspace Requirements](/shared/angular-tutorial/requirements-diagram.svg)
{% /side-by-side %}

Your graph now matches the original design.

The Project Graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Workspace Optimization](/angular-tutorial/4-workspace-optimization).

## What's Next

- Continue to [3: Task Running](/angular-tutorial/3-task-running)
