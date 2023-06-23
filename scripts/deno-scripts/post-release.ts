import { Octokit, App } from 'https://esm.sh/octokit?dts';
import * as semver from 'https://deno.land/x/semver/mod.ts';

const NEXT_MAJOR_VERSION_LABEL = 'target: next major version';
const WAIT_FOR_NEXT_RELEASE_LABEL = 'pr status: wait-for-release';

type PullRequest = Awaited<
  ReturnType<Octokit['rest']['pulls']['list']>
>['data'][0];
type Label = PullRequest['labels'][0];
type Release = Awaited<
  ReturnType<Octokit['rest']['repos']['listReleases']>
>['data'][0];

if (Deno.args.length !== 1) {
  throw new Error('Expected one argument: the release JSON');
}

const release: Release = JSON.parse(Deno.args[0]);

const octokit: Octokit = new Octokit({
  auth: Deno.env.get('GITHUB_TOKEN'),
});

updateLabelsAfterRelase(release);

async function updateLabelsAfterRelase(release: Release) {
  const version = semver.coerce(release.tag_name);
  if (!version) {
    // We couldnt determine the version, so skip automated label updates.
    return;
  }
  // The published release is a prerelease for the next major version, so it should be safe to
  // merge stuff that targets the next major version.
  const mergingStuffForNextMajor =
    version.prerelease.length > 0 && version.minor === 0 && version.patch === 0;

  await forEachPullRequest((pr) => {
    let updatedLabels: Label[] = pr.labels;
    if (mergingStuffForNextMajor) {
      updatedLabels = updatedLabels.filter(
        (l: Label) => l.name.toLowerCase() !== NEXT_MAJOR_VERSION_LABEL
      );
    }
    // We released a major or minor version, since its not a prerelease and the patch version is 0.
    if (version.prerelease.length === 0 && version.patch === 0) {
      updatedLabels = updatedLabels.filter(
        (l: Label) => l.name.toLowerCase() !== WAIT_FOR_NEXT_RELEASE_LABEL
      );
    }
    if (updatedLabels.length !== pr.labels.length) {
      // A pull request is a special kind of issue according to the GitHub API.
      octokit.rest.issues.update({
        owner: 'nrwl',
        repo: 'nx',
        issue_number: pr.number,
        updatedLabels,
      });
    }
  });
}

async function forEachPullRequest(callback: (pr: PullRequest) => void) {
  for await (const slice of octokit.paginate.iterator(octokit.rest.pulls.list, {
    owner: 'nrwl',
    repo: 'nx',
    state: 'open',
  })) {
    for (const pr of slice.data) {
      callback(pr);
    }
  }
}
