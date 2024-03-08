import { RefObject, createRef, useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { InputDefinition } from 'nx/src/config/workspace-json-project-json';
// nx-ignore-next-line
import type { ExpandedInputs } from 'nx/src/command-line/graph/inputs-utils';
/* eslint-enable @nx/enforce-module-boundaries */

import {
  PropertyInfoTooltip,
  TaskInputsListAccordions,
  TaskInputsListWithSearch,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { Modal, ModalHandle } from '@nx/graph/ui-components';
import { TooltipTriggerText } from './tooltip-trigger-text';
import { CopyToClipboard } from './copy-to-clipboard';
import { TargetConfigurationProperty } from './target-configuration-property';
import { SourceInfo } from './source-info';
import { selectSourceInfo } from './target-configuration-details.util';

export interface TargetConfigurationDetailsInputsProps {
  inputs: (InputDefinition | string)[] | undefined;
  sourceMap: Record<string, string[]>;
  targetName: string;
  projectName: string;
  handleCopyClick: (text: string) => void;
  getInputs?: (
    taskId: string
  ) => Promise<{ [inputName: string]: ExpandedInputs } | undefined>;
  taskId: string;
}

export function TargetConfigurationDetailsInputs({
  inputs,
  sourceMap,
  targetName,
  projectName,
  handleCopyClick,
  getInputs,
  taskId,
}: TargetConfigurationDetailsInputsProps) {
  const [filesForAllInputs, setFilesForAllInputs] = useState<{
    [inputName: string]: ExpandedInputs;
  }>({});
  const [isInputsLoading, setIsInputsLoading] = useState(false);
  const inputRefs = useRef(
    inputs?.reduce((acc, inputName) => {
      if (inputName && typeof inputName === 'string') {
        acc[inputName] = createRef<ModalHandle>();
      }
      return acc;
    }, {} as Record<string, RefObject<ModalHandle>>)
  );
  const inputsModalRef = createRef<ModalHandle>();

  useEffect(() => {
    if (inputs && getInputs) {
      setIsInputsLoading(true);
      getInputs(taskId).then((files) => {
        if (files) {
          setFilesForAllInputs(files);
        }
        setIsInputsLoading(false);
      });
    }
  }, [inputs, getInputs, taskId]);

  if (!inputs || inputs.length === 0) {
    return null;
  }
  return (
    <div className="group">
      <h4 className="mb-4">
        <Tooltip
          openAction="hover"
          content={(<PropertyInfoTooltip type="inputs" />) as any}
        >
          <span className="font-medium">
            <TooltipTriggerText>Inputs</TooltipTriggerText>
          </span>
        </Tooltip>
        <span className="hidden group-hover:inline ml-2 mb-1">
          <CopyToClipboard
            onCopy={() =>
              handleCopyClick(`"inputs": ${JSON.stringify(inputs)}`)
            }
          />
          <button
            data-tooltip="View files"
            type="button"
            className="ml-2"
            onClick={() => inputsModalRef.current?.openModal()}
          >
            <MagnifyingGlassIcon
              className={`inline h-4 w-5`}
            ></MagnifyingGlassIcon>
          </button>
        </span>
      </h4>
      <Modal title={`${targetName} Inputs`} ref={inputsModalRef}>
        <TaskInputsListAccordions
          inputs={filesForAllInputs}
          isLoading={isInputsLoading}
          projectName={projectName}
        />
      </Modal>
      <ul className="list-disc pl-5 mb-4">
        {inputs.map((input, index) => {
          const sourceInfo = selectSourceInfo(
            sourceMap,
            `targets.${targetName}.inputs`
          );
          return (
            <>
              <li
                className="group/line list-none whitespace-nowrap"
                key={`input-${index}`}
              >
                <TargetConfigurationProperty data={input}>
                  <span className="opacity-0 flex shrink-1 min-w-0 group-hover/line:opacity-100 transition-opacity duration-150 ease-in-out inline pl-4">
                    {typeof input === 'string' && (
                      <button
                        data-tooltip="View files"
                        type="button"
                        className="mr-3"
                        onClick={() => {
                          inputRefs.current?.[input]?.current?.openModal();
                        }}
                      >
                        <MagnifyingGlassIcon
                          className={`inline h-4 w-5`}
                        ></MagnifyingGlassIcon>
                      </button>
                    )}
                    {sourceInfo && (
                      <SourceInfo
                        data={sourceInfo}
                        propertyKey={`targets.${targetName}.inputs`}
                      />
                    )}
                  </span>
                </TargetConfigurationProperty>
              </li>
              {typeof input === 'string' && (
                <Modal title={input} ref={inputRefs.current?.[input]}>
                  <TaskInputsListWithSearch
                    inputs={filesForAllInputs[input]}
                    isLoading={isInputsLoading}
                    projectName={projectName}
                    inputName={input}
                  />
                </Modal>
              )}
            </>
          );
        })}
      </ul>
    </div>
  );
}
