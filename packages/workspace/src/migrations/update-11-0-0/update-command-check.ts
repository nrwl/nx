export default function update() {
  return () => {
    if (process.argv[2] === 'update') {
      console.log(
        '-------------------------------------------------------------'
      );
      console.log(
        '-------------------------------------------------------------'
      );
      console.log(
        '-------------------------------------------------------------'
      );
      console.log(
        `Nx provides a much improved version of "ng update". It runs the same migrations, but allows you to:`
      );
      console.log(`- rerun the same migration multiple times`);
      console.log(`- reorder migrations`);
      console.log(`- skip migrations`);
      console.log(`- fix migrations that "almost work"`);
      console.log(`- commit a partially migrated state`);
      console.log(`- change versions of packages to match org requirements`);
      console.log(
        `And, in general, it is lot more reliable for non-trivial workspaces. Read more at: https://nx.dev/latest/angular/workspace/update`
      );
      console.log(
        `Run "nx migrate latest" to update to the latest version of Nx.`
      );
      console.log(
        '-------------------------------------------------------------'
      );
      console.log(
        '-------------------------------------------------------------'
      );
      console.log(
        '-------------------------------------------------------------'
      );
      throw new Error(
        `Use "nx migrate" instead of "ng update". Read more at: Read more at: https://nx.dev/latest/angular/workspace/update`
      );
    }
  };
}
