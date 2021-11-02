# Adding Images, Fonts, and Files

With Nx, you can **`import` assets directly from your TypeScript/JavaScript code**.

```typescript
import React from 'react';
import logo from './logo.png';

const Header = () => <img src={logo} alt="Logo" />;

export default Header;
```

This import will be replaced by a string of the image path when the application builds. To reduce the number of network requests, if the image file size is less than 10 kB, then the image will be inlined using [data URI](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) instead of a path.

This works in CSS files as well.

```css
.logo {
  background-image: url(./logo.png);
}
```

## Adding SVGs

SVG images can be imported using the method described above.

Alternatively, you can import SVG images as React components.

```typescript
import React from 'react';
import { ReactComponent as Logo } from './logo.svg';

const Header = () => <Logo title="Logo" />;

export default Header;
```

This method of import allow you to work with the SVG the same way you would with any other React component. You can style it using CSS, styled-components, etc. The SVG component accepts a `title` prop, as well as any other props that the `svg` element accepts.

Note that if you are using Next.js, you have to opt into this behavior. To import SVGs as React components with Next.js, you need to make sure that `nx.svgr` value is set to `true` in your Next.js application's `next.config.js` file:

```js
module.exports = withNx({
  nx: {
    svgr: true,
  },
});
```
