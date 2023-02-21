import {
  Attributes,
  cloneElement,
  Fragment,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  FloatingPortal,
  useClick,
  arrow,
  autoUpdate,
  flip,
  offset,
  Placement,
  ReferenceType,
  shift,
  useFloating,
  useInteractions,
  useDismiss,
  useHover,
  useRole,
} from '@floating-ui/react';

export type TooltipProps = HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  content: ReactNode;
  children?: ReactElement;
  placement?: Placement;
  reference?: ReferenceType;
  openAction?: 'click' | 'hover' | 'manual';
  strategy?: 'absolute' | 'fixed';
};

export function Tooltip({
  children,
  open = false,
  content,
  placement = 'top',
  reference: externalReference,
  openAction = 'click',
  strategy = 'absolute',
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(open);
  const arrowRef = useRef(null);

  const {
    x,
    y,
    refs,
    strategy: appliedStrategy,
    placement: finalPlacement,
    middlewareData: { arrow: { x: arrowX, y: arrowY } = {} },
    context,
  } = useFloating({
    placement,
    whileElementsMounted: strategy === 'fixed' ? autoUpdate : undefined,
    open: isOpen,
    onOpenChange: setIsOpen,
    strategy,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 6 }),
      arrow({ element: arrowRef }),
    ],
  });

  const staticSide: string =
    {
      top: 'bottom',
      right: 'left',
      bottom: 'top',
      left: 'right',
    }[finalPlacement.split('-')[0]] || 'bottom';

  useLayoutEffect(() => {
    if (!!externalReference) {
      refs.setReference(externalReference);
    }
  }, [refs, externalReference]);

  const click = useClick(context, { enabled: openAction === 'click' });
  const dismiss = useDismiss(context, {
    enabled: openAction === 'click',
    referencePress: false,
    outsidePress: true,
    outsidePressEvent: 'mousedown',
  });
  const hover = useHover(context, { enabled: openAction === 'hover' });
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    hover,
    dismiss,
    role,
  ]);

  const cloneProps: Partial<any> & Attributes = {
    ref: refs.setReference,
    ...getReferenceProps(),
  };

  return (
    <>
      {!externalReference && !!children
        ? cloneElement(children, cloneProps)
        : children}
      {isOpen ? (
        <div
          ref={refs.setFloating}
          style={{
            position: appliedStrategy,
            top: y ?? 0,
            left: x ?? 0,
            width: 'max-content',
          }}
          className="z-10 min-w-[250px] rounded-md border border-slate-500"
          {...getFloatingProps()}
        >
          <div
            style={{
              left: arrowX != null ? `${arrowX}px` : '',
              top: arrowY != null ? `${arrowY}px` : '',
              right: '',
              bottom: '',
              [staticSide]: '-4px',
            }}
            className="absolute -z-10 h-4 w-4 rotate-45 bg-slate-500"
            ref={arrowRef}
          ></div>
          <div className="select-text rounded-md bg-white p-3 dark:bg-slate-900 dark:text-slate-400">
            {content}
          </div>
        </div>
      ) : null}
    </>
  );
}
