// nx-ignore-next-line
import type { GraphError } from 'nx/src/command-line/graph/graph';
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { SetURLSearchParams, useSearchParams } from 'react-router-dom';
import { ErrorToastUI, ErrorToastUIImperativeHandle } from './error-toast-ui';

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
    const errorToastUIRef = useRef<ErrorToastUIImperativeHandle>();

    const [searchParams, setSearchParams] = useSearchParams();

    useImperativeHandle(ref, () => ({
      openModal: () => {
        errorToastUIRef?.current?.openModal();
      },
      closeModal: () => {
        errorToastUIRef?.current?.closeModal();
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
          errorToastUIRef.current?.openModal();
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
    }, [searchParams, errorToastUIRef, errors, setSearchParams]);

    return (
      <ErrorToastUI
        ref={errorToastUIRef}
        errors={errors}
        onModalOpen={handleModalOpen}
        onModalClose={handleModalClose}
      ></ErrorToastUI>
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
