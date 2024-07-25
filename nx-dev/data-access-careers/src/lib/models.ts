export interface LeverJob {
  additional: string;
  additionalPlain: string;
  applyUrl: string;
  categories: {
    commitment: string;
    location: string;
    team: string;
  };
  createdAt: number;
  description: string;
  descriptionPlain: string;
  hostedUrl: string;
  id: string;
  lists: { text: string; content: string }[];
  text: string;
}

export interface Job {
  location: string;
  team: string;
  title: string;
  url: string;
}
