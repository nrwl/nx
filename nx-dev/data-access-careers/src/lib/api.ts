import { Job, LeverJob } from './models';

export async function fetchJobsList(): Promise<Job[]> {
  const apiUrl = 'https://api.lever.co/v0/postings/nrwl?mode=json';

  const res = await fetch(apiUrl, { cache: 'no-store' });

  if (res.ok) {
    const data = (await res.json()) as LeverJob[];
    return data.map((job: LeverJob) => ({
      title: job.text,
      location: job.categories.location,
      team: job.categories.team,
      url: job.hostedUrl,
    }));
  } else {
    return [];
  }
}
