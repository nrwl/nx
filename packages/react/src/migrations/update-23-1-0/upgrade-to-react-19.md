#### Upgrade React 18 to 19

Bumps `react`, `react-dom`, and the React type packages from 18 to 19. React 19 removes several long-deprecated APIs; the change every project hits is the root API (`ReactDOM.render` -> `createRoot`). Read more in the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide).

The paired AI instructions migration walks an agent through the full set of changes. The common ones are shown below.

#### Examples

##### Before

```tsx title="src/main.tsx"
import ReactDOM from 'react-dom';

ReactDOM.render(<App />, document.getElementById('root'));
```

##### After

```tsx title="src/main.tsx"
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(<App />);
```

`defaultProps` on a function component becomes a default parameter:

##### Before

```tsx
function Badge({ color }) {}
Badge.defaultProps = { color: 'gray' };
```

##### After

```tsx
function Badge({ color = 'gray' }) {}
```
