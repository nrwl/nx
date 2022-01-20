const cp = require('child_process');

async function calculate() {
  const aa = await Promise.all(
    [1, 2, 3, 4, 5].map((q) => {
      const v = cp
        .execSync(
          `curl -i "https://api.github.com/repos/nrwl/nx/issues?state=open&page=${q}&per_page=100"`
        )
        .toString();
      const substr = v.substring(v.indexOf('['));
      return JSON.parse(substr);
    })
  );
  let all = [];
  aa.forEach((a) => all.push(...a));
  all = all.filter((a) => a.html_url.indexOf('/pull') === -1);
  console.log('total number', all.length);

  const grouped = {};
  all.forEach((i) => {
    const ll = i.labels;
    let scope = (
      ll.find((lll) => lll.name.indexOf('scope:') > -1) || {
        name: 'no-scope',
      }
    ).name;

    if (
      scope === 'scope: react' ||
      scope === 'scope: nextjs' ||
      scope === 'scope: gatsby'
    ) {
      scope = 'scope: react+next+gatsby';
    }

    if (!grouped[scope]) grouped[scope] = [];
    grouped[scope].push(i);
  });

  let totalBugs = 0;
  Object.keys(grouped).forEach((k) => {
    const bugs = grouped[k].filter((i) => {
      const ll = i.labels;
      return !!ll.find((lll) => lll.name.indexOf('type: bug') > -1);
    });
    totalBugs += bugs.length;
    console.log(`${k}, issues: ${grouped[k].length}, bugs: ${bugs.length}`);
  });

  console.log('without scope');
  grouped['no-scope'].forEach((issue) => {
    if (
      issue.labels.every((lll) => lll.name.indexOf('type: question') === -1)
    ) {
      console.log(issue.html_url);
    } else {
      // console.log(`question: ${issue.html_url}`);
    }
  });

  console.log(`Total bugs: ${totalBugs}`);
}

calculate()
  .then(() => {
    console.log('done');
  })
  .catch((e) => console.log(e));
