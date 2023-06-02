# React Standalone Tutorial - Part 2: Project Graph

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

## Set Up the Router

Install the `react-router-dom` package:

```shell
npm i react-router-dom
```

And configure the routes:

```javascript {% fileName="src/main.tsx" %}
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';

import App from './app/app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

```javascript {% fileName="src/app/app.tsx" %}
import { Cart } from '@store/cart';
import { Route, Routes } from 'react-router-dom';
import Shop from './shop/shop';

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Shop />}></Route>
        <Route path="/cart" element={<Cart />}></Route>
      </Routes>
    </>
  );
}

export default App;
```

{% callout type="note" title="Typescript Paths" %}
When a library is created, Nx adds a new Typescript path to the `tsconfig.base.json` file. The running Typescript server process inside of your editor sometimes doesn't pick up these changes and you have to restart the server to remove inline errors on your import statements. This can be done in VS Code from the command palette when viewing a typescript file (Command-Shift-P) "Typescript: Restart TS server"
{% /callout %}

### `shared-ui`

Run the `@nx/react:component` generator with the command:

```{% command="npx nx g @nx/react:component banner --project=shared-ui --export" path="~/store" %}

>  NX  Generating @nx/react:component

CREATE shared/ui/src/lib/banner/banner.module.css
CREATE shared/ui/src/lib/banner/banner.spec.tsx
CREATE shared/ui/src/lib/banner/banner.tsx
UPDATE shared/ui/src/index.ts
```

Then create a simple `Banner` component in the generated file:

```javascript {% fileName="shared/ui/src/lib/banner/banner.tsx" %}
export interface BannerProps {
  text: string;
}

export function Banner(props: BannerProps) {
  return <header>{props.text}</header>;
}

export default Banner;
```

### `cart`

Add the `Banner` component to the cart route and link back to the main page:

```javascript {% fileName="cart/src/lib/cart.tsx" %}
import { Banner } from '@store/shared/ui';
import { Link } from 'react-router-dom';
import styles from './cart.module.css';

/* eslint-disable-next-line */
export interface CartProps {}

export function Cart(props: CartProps) {
  return (
    <div className={styles['container']}>
      <Banner text="Welcome to the cart." />
      <Link to="/">Continue Shopping</Link>
    </div>
  );
}

export default Cart;
```

### `store`

Update the `shop` component to use the `Banner` component and link to the cart.

```javascript {% fileName="src/app/shop/shop.tsx" %}
import { Banner } from '@store/shared/ui';
import { Link } from 'react-router-dom';
import styles from './shop.module.css';

/* eslint-disable-next-line */
export interface ShopProps {}

export function Shop(props: ShopProps) {
  return (
    <div className={styles['container']}>
      <Banner text="Here is a list of products to buy..." />
      <Link to="/cart">View Cart</Link>
    </div>
  );
}

export default Shop;
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
      { "source": "store", "target": "cart", "type": "static" },
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

The Project Graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Task Pipelines](/react-standalone-tutorial/4-task-pipelines).

## What's Next

- Continue to [3: Task Running](/react-standalone-tutorial/3-task-running)
