export function createAppJsx(name: string) {
  return `
    <h2>Resources &amp; Tools</h2>
    <p>
      Thank you for using and showing some ♥ for Nx.
    </p>
    <div className="flex github-star-container">
      <a href="https://github.com/nrwl/nx" target="_blank" rel="noopener noreferrer"> If you like Nx, please give it a star:
        <div className="github-star-badge">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/star.svg" className="material-icons" alt="" />
            Star
        </div>
      </a>
    </div>
    <p>
      Here are some links to help you get started.
    </p>
    <ul className="resources">
      <li className="col-span-2">
        <a
          className="resource flex"
          href="https://egghead.io/playlists/scale-react-development-with-nx-4038"
        >
          Scale React Development with Nx (Course)
        </a>
      </li>
      <li className="col-span-2">
        <a
          className="resource flex"
          href="https://nx.dev/latest/react/tutorial/01-create-application"
        >
          Interactive tutorial
        </a>
      </li>
      <li className="col-span-2">
        <a className="resource flex" href="https://nx.app/">
          <svg width="36" height="36" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M120 15V30C103.44 30 90 43.44 90 60C90 76.56 76.56 90 60 90C43.44 90 30 103.44 30 120H15C6.72 120 0 113.28 0 105V15C0 6.72 6.72 0 15 0H105C113.28 0 120 6.72 120 15Z" fill="#0E2039"/>
            <path d="M120 30V105C120 113.28 113.28 120 105 120H30C30 103.44 43.44 90 60 90C76.56 90 90 76.56 90 60C90 43.44 103.44 30 120 30Z" fill="white"/>
          </svg>
          <span className="gutter-left">Nx Cloud</span>
        </a>
      </li>
    </ul>
    <h2>Next Steps</h2>
    <p>
      Here are some things you can do with Nx.
    </p>
    <details open>
      <summary>Add UI library</summary>
      <pre>{\`# Generate UI lib
nx g @nrwl/react:lib ui

# Add a component
nx g @nrwl/react:component xyz --project ui\`}</pre>
    </details>
    <details>
      <summary>View dependency graph</summary>
      <pre>{\`nx dep-graph\`}</pre>
    </details>
    <details>
      <summary>Run affected commands</summary>
      <pre>{\`# see what's been affected by changes
nx affected:dep-graph

# run tests for current changes
nx affected:test

# run e2e tests for current changes
nx affected:e2e
\`}</pre>
    </details>
  `;
}

export function createStyleRules() {
  return `
.app {
  font-family: sans-serif;
  min-width: 300px;
  max-width: 600px;
  margin: 50px auto;
}

.app .gutter-left {
  margin-left: 9px;
}

.app .col-span-2 {
  grid-column: span 2;
}

.app .flex {
  display: flex;
  align-items: center;
  justify-content: center;
}

.app header {
  background-color: #143055;
  color: white;
  padding: 5px;
  border-radius: 3px;
}

.app main {
  padding: 0 36px;
}

.app p {
  text-align: center;
}

.app h1 {
  text-align: center;
  margin-left: 18px;
  font-size: 24px;
}

.app h2 {
  text-align: center;
  font-size: 20px;
  margin: 40px 0 10px 0;
}

.app .resources {
  text-align: center;
  list-style: none;
  padding: 0;
  display: grid;
  grid-gap: 9px;
  grid-template-columns: 1fr 1fr;
}

.app .resource {
  color: #0094ba;
  height: 36px;
  background-color: rgba(0, 0, 0, 0);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 3px 9px;
  text-decoration: none;
}

.app .resource:hover {
  background-color: rgba(68, 138, 255, 0.04);
}

.app pre {
  padding: 9px;
  border-radius: 4px;
  background-color: black;
  color: #eee;
}

.app details {
  border-radius: 4px;
  color: #333;
  background-color: rgba(0, 0, 0, 0);
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 3px 9px;
  margin-bottom: 9px;
}

.app summary {
  outline: none;
  height: 36px;
  line-height: 36px;
}

.app .github-star-container {
  margin-top: 12px;
  line-height: 20px;
}

.app .github-star-container a {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #333;
}

.app .github-star-badge {
  color: #24292e;
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 3px 10px;
  border: 1px solid rgba(27,31,35,.2);
  border-radius: 3px;
  background-image: linear-gradient(-180deg,#fafbfc,#eff3f6 90%);
  margin-left: 4px;
  font-weight: 600;
}

.app .github-star-badge:hover {
  background-image: linear-gradient(-180deg,#f0f3f6,#e6ebf1 90%);
  border-color: rgba(27,31,35,.35);
  background-position: -.5em;
}
.app .github-star-badge .material-icons {
  height: 16px;
  width: 16px;
  margin-right: 4px;
}
`;
}
