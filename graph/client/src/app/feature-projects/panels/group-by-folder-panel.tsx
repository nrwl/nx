import { CheckboxPanel } from '../../ui-components/checkbox-panel';

export interface DisplayOptionsPanelProps {
  groupByFolder: boolean;
  groupByFolderChanged: (checked: boolean) => void;
}

export const GroupByFolderPanel = ({
  groupByFolder,
  groupByFolderChanged,
}: DisplayOptionsPanelProps) => {
  return (
    <CheckboxPanel
      checked={groupByFolder}
      checkChanged={groupByFolderChanged}
      name={'groupByFolder'}
      label={'Group by folder'}
      description={'Visually arrange libraries by folders.'}
    />
  );
};
