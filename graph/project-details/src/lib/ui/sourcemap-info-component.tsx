interface SourceMapInfoProps {
  sourceMap: Record<string, string[]>;
  targetName: string;
  key: string;
}

export const SourceMapInfo: React.FC<SourceMapInfoProps> = ({
  sourceMap,
  targetName,
  key,
}) => {
  const specificKey = `targets.${targetName}.options.${key}`;
  const genericKey = `targets.${targetName}.options`;

  if (sourceMap?.[specificKey]?.length > 0) {
    return (
      <span className="pl-4 hidden group-hover:inline italic text-gray-500">
        Created by {sourceMap[specificKey][1]} from {sourceMap[specificKey][0]}
      </span>
    );
  } else if (sourceMap?.[genericKey]?.length > 0) {
    return (
      <span className="pl-4 hidden group-hover:inline italic text-gray-500">
        Created by {sourceMap[genericKey][1]} from {sourceMap[genericKey][0]}
      </span>
    );
  } else {
    return null;
  }
};
