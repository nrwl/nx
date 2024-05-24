/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */

import {
  createRef,
  ForwardedRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
} from 'react';

import { Transition } from '@headlessui/react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { SetURLSearchParams, useSearchParams } from 'react-router-dom';
import { ErrorRenderer, Modal, ModalHandle } from '@nx/graph/ui-components';

export interface ErrorToastImperativeHandle {
  closeModal: () => void;
  openModal: () => void;
}

interface ErrorToastProps {
  errors?: GraphError[] | undefined;
}

export const ErrorToast = forwardRef(
  (
    { errors }: ErrorToastProps,
    ref: ForwardedRef<ErrorToastImperativeHandle>
  ) => {
    const inputsModalRef = createRef<ModalHandle>();

    const [searchParams, setSearchParams] = useSearchParams();

    useImperativeHandle(ref, () => ({
      openModal: () => {
        inputsModalRef?.current?.openModal();
      },
      closeModal: () => {
        inputsModalRef?.current?.closeModal();
      },
    }));

    const handleModalOpen = useCallback(() => {
      if (searchParams.get('show-error') === 'true') return;
      setSearchParams(
        (currentSearchParams) => {
          currentSearchParams.set('show-error', 'true');
          return currentSearchParams;
        },
        { replace: true, preventScrollReset: true }
      );
    }, [setSearchParams, searchParams]);

    const handleModalClose = useCallback(() => {
      if (!searchParams.get('show-error')) return;
      setSearchParams(
        (currentSearchParams) => {
          currentSearchParams.delete('show-error');
          return currentSearchParams;
        },
        { replace: true, preventScrollReset: true }
      );
    }, [setSearchParams, searchParams]);

    useLayoutEffect(() => {
      if (searchParams.get('show-error') === 'true') {
        if (errors && errors.length > 0) {
          inputsModalRef.current?.openModal();
        } else {
          setSearchParams(
            (currentSearchParams) => {
              currentSearchParams.delete('show-error');
              return currentSearchParams;
            },
            { replace: true, preventScrollReset: true }
          );
        }
      }
    }, [searchParams, inputsModalRef, errors, setSearchParams]);

    return (
      <Transition
        show={!!errors && errors.length > 0}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-x-0 bottom-0 px-4 py-2 text-center">
          <div
            onClick={() => inputsModalRef.current?.openModal()}
            className="z-50 mx-auto flex w-fit max-w-[75%] cursor-pointer items-center rounded-md bg-red-600 p-4 text-slate-200 shadow-lg"
          >
            <ExclamationCircleIcon className="mr-2 inline-block h-6 w-6" />
            Some project information might be missing. Click to see errors.
          </div>
          {errors?.length > 0 && (
            <Modal
              title={`Project Graph Errors`}
              ref={inputsModalRef}
              onOpen={handleModalOpen}
              onClose={handleModalClose}
            >
              <ErrorRenderer errors={errors ?? []} />
            </Modal>
          )}
        </div>
      </Transition>
    );
  }
);

export const useRouterHandleModalOpen = (
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams
) =>
  useCallback(() => {
    if (searchParams.get('show-error') === 'true') return;
    setSearchParams(
      (currentSearchParams) => {
        currentSearchParams.set('show-error', 'true');
        return currentSearchParams;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [setSearchParams, searchParams]);
