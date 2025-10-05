import { Transition } from '@headlessui/react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
import { ForwardedRef, forwardRef, useImperativeHandle, useRef } from 'react';
import { ErrorRenderer } from './error-renderer';
import { Modal, ModalHandle } from '../modal';

export type ErrorToastUIProps = {
  errors?: GraphError[] | undefined;
  onModalOpen?: () => void;
  onModalClose?: () => void;
};

export type ErrorToastUIImperativeHandle = {
  closeModal: () => void;
  openModal: () => void;
};

export const ErrorToastUI = forwardRef(
  (
    { errors, onModalOpen, onModalClose }: ErrorToastUIProps,
    ref: ForwardedRef<ErrorToastUIImperativeHandle | undefined>
  ) => {
    const inputsModalRef = useRef<ModalHandle>();

    useImperativeHandle(ref, () => ({
      openModal: () => {
        inputsModalRef?.current?.openModal();
      },
      closeModal: () => {
        inputsModalRef?.current?.closeModal();
      },
    }));

    return (
      <Transition
        as="div"
        show={!!errors && errors.length > 0}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-x-0 top-4 z-50 px-4 py-2 text-center">
          <div
            onClick={() => inputsModalRef.current?.openModal()}
            className="z-50 flex w-fit max-w-sm
             cursor-pointer items-center rounded-md bg-red-600
            p-4 text-slate-200 shadow-lg"
          >
            <ExclamationCircleIcon className="mr-2 inline-block h-6 w-6" />
            Some project information might be missing. Click to see errors.
          </div>
          {errors?.length > 0 && (
            <Modal
              title={`Project Graph Errors`}
              ref={inputsModalRef}
              onOpen={onModalOpen}
              onClose={onModalClose}
            >
              <ErrorRenderer errors={errors ?? []} />
            </Modal>
          )}
        </div>
      </Transition>
    );
  }
);
