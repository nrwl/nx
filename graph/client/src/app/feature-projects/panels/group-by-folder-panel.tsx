import { CheckboxPanel } from '../../ui-components/checkbox-panel';

export interface DisplayOptionsPanelProps {
  groupByFolder: boolean;
  groupByFolderChanged: (checked: boolean) => void;
  disabled?: boolean;
  disabledDescription?: string;
}

export const GroupByFolderPanel = ({
  groupByFolder,
  groupByFolderChanged,
  disabled,
  disabledDescription,
}: DisplayOptionsPanelProps) => {
  return (
    <CheckboxPanel
      checked={groupByFolder}
      checkChanged={groupByFolderChanged}
      name={'groupByFolder'}
      label={'Group by folder'}
      description={'Visually arrange libraries by folders.'}
      disabled={disabled}
      disabledDescription={disabledDescription}
    />
  );
};
