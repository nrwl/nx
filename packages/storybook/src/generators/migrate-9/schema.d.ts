export interface Schema {
  autoAcceptAllPrompts?: boolean;
  onlyShowListOfCommands?: boolean;
  noUpgrade?: boolean;
  versionTag: 'latest' | 'next';
}
