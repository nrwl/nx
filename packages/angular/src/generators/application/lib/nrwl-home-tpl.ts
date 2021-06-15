export const nrwlHomeTemplate = {
  html: `
  <header class="flex">
      <img alt="Nx logo" width="75" src="https://nx.dev/assets/images/nx-logo-white.svg" />
      <h1>Welcome to {{title}}!</h1>
  </header>
  <main>
      <h2>Resources &amp; Tools</h2>
      <p>
        Thank you for using and showing some ♥ for Nx.
      </p>
      <div class="flex github-star-container">
        <a href="https://github.com/nrwl/nx" target="_blank" rel="noopener noreferrer"> If you like Nx, please give it a star:
          <div class="github-star-badge">
            <svg class="material-icons" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              Star
          </div>
        </a>
      </div>
      <p>
        Here are some links to help you get started.
      </p>
      <ul class="resources">
          <li class="col-span-2">
              <a
                      class="resource flex"
                      href="https://nxplaybook.com/p/nx-workspaces"
              >
                  Nx video course
              </a>
          </li>
          <li class="col-span-2">
              <a
                      class="resource flex"
                      href="https://nx.dev/latest/angular/getting-started/getting-started"
              >
                  Nx video tutorial
              </a>
          </li>
          <li class="col-span-2">
              <a
                      class="resource flex"
                      href="https://nx.dev/latest/angular/tutorial/01-create-application"
              >
                  Interactive tutorial
              </a>
          </li>
          <li class="col-span-2">
              <a class="resource flex" href="https://nx.app/">
                  <svg width="36" height="36" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M120 15V30C103.44 30 90 43.44 90 60C90 76.56 76.56 90 60 90C43.44 90 30 103.44 30 120H15C6.72 120 0 113.28 0 105V15C0 6.72 6.72 0 15 0H105C113.28 0 120 6.72 120 15Z" fill="#0E2039"/>
                    <path d="M120 30V105C120 113.28 113.28 120 105 120H30C30 103.44 43.44 90 60 90C76.56 90 90 76.56 90 60C90 43.44 103.44 30 120 30Z" fill="white"/>
                  </svg>
                  <span class="gutter-left">Nx Cloud</span>
              </a>
          </li>
      </ul>
      <h2>Next Steps</h2>
      <p>Here are some things you can do with Nx.</p>
      <details open>
          <summary>Add UI library</summary>
          <pre>
  # Generate UI lib
  nx g @nrwl/angular:lib ui
  
  # Add a component
  nx g @nrwl/angular:component xyz --project ui</pre
          >
      </details>
      <details>
          <summary>View dependency graph</summary>
          <pre>nx dep-graph</pre>
      </details>
      <details>
          <summary>Run affected commands</summary>
          <pre>
  # see what's been affected by changes
  nx affected:dep-graph
  
  # run tests for current changes
  nx affected:test
  
  # run e2e tests for current changes
  nx affected:e2e
  </pre
          >
      </details>
  </main>
    `,
  css: `
  /*
   * Remove template code below
   */
  :host {
    display: block;
    font-family: sans-serif;
    min-width: 300px;
    max-width: 600px;
    margin: 50px auto;
  }
  
  .gutter-left {
    margin-left: 9px;
  }
  
  .col-span-2 {
    grid-column: span 2;
  }
  
  .flex {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  header {
    background-color: #143055;
    color: white;
    padding: 5px;
    border-radius: 3px;
  }
  
  main {
    padding: 0 36px;
  }
  
  p {
    text-align: center;
  }
  
  h1 {
    text-align: center;
    margin-left: 18px;
    font-size: 24px;
  }
  
  h2 {
    text-align: center;
    font-size: 20px;
    margin: 40px 0 10px 0;
  }
  
  .resources {
    text-align: center;
    list-style: none;
    padding: 0;
    display: grid;
    grid-gap: 9px;
    grid-template-columns: 1fr 1fr;
  }
  
  .resource {
    color: #0094ba;
    height: 36px;
    background-color: rgba(0, 0, 0, 0);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    padding: 3px 9px;
    text-decoration: none;
  }
  
  .resource:hover {
    background-color: rgba(68, 138, 255, 0.04);
  }
  
  pre {
    padding: 9px;
    border-radius: 4px;
    background-color: black;
    color: #eee;
  }
  
  details {
    border-radius: 4px;
    color: #333;
    background-color: rgba(0, 0, 0, 0);
    border: 1px solid rgba(0, 0, 0, 0.12);
    padding: 3px 9px;
    margin-bottom: 9px;
  }
  
  summary {
    cursor: pointer;
    outline: none;
    height: 36px;
    line-height: 36px;
  }
  
  .github-star-container {
    margin-top: 12px;
    line-height: 20px;
  }
  
  .github-star-container a {
    display: flex;
    align-items: center;
    text-decoration: none;
    color: #333;
  }
  
  .github-star-badge {
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
  
  .github-star-badge:hover {
    background-image: linear-gradient(-180deg,#f0f3f6,#e6ebf1 90%);
    border-color: rgba(27,31,35,.35);
    background-position: -.5em;
  }
  .github-star-badge .material-icons {
    height: 16px;
    width: 16px;
    margin-right: 4px;
  }
    `,
};
