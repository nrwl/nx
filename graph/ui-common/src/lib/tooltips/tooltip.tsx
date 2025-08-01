import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  Placement,
  ReferenceType,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import {
  Attributes,
  cloneElement,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

export type TooltipProps = Omit<HTMLAttributes<HTMLDivElement>, 'content'> & {
  open?: boolean;
  content: ReactNode;
  children?: ReactElement;
  placement?: Placement;
  reference?: ReferenceType;
  openAction?: 'click' | 'hover' | 'manual';
  buffer?: number;
  showTooltipArrow?: boolean;
  strategy?: 'absolute' | 'fixed';
  usePortal?: boolean;
};

export function Tooltip({
  children,
  open = false,
  content,
  placement = 'top',
  reference: externalReference,
  openAction = 'click',
  strategy = 'absolute',
  buffer = 0,
  showTooltipArrow = true,
  usePortal = false,
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

  const { isMounted, styles: animationStyles } = useTransitionStyles(context, {
    duration: 200,
    initial: {
      opacity: openAction === 'hover' ? 0 : 1,
    },
  });

  const staticSide: string =
    {
      top: 'bottom',
      right: 'left',
      bottom: 'top',
      left: 'right',
    }[finalPlacement.split('-')[0]] || 'bottom';

  useLayoutEffect(() => {
    if (externalReference) {
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
  const hover = useHover(context, {
    restMs: 300,
    enabled: openAction === 'hover',
    delay: { open: 0, close: 150 },
    handleClose: safePolygon({ buffer }),
  });
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

  const renderTooltip = () => (
    <div
      ref={refs.setFloating}
      style={{
        position: appliedStrategy,
        top: showTooltipArrow ? y : y + 8,
        left: x ?? 0,
        width: 'max-content',
        ...animationStyles,
      }}
      className="z-20 min-w-[250px] max-w-prose rounded-md border border-slate-500"
      {...getFloatingProps()}
    >
      {showTooltipArrow && (
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
      )}
      <div className="select-text rounded-md bg-white p-3 dark:bg-slate-900 dark:text-slate-400">
        {content}
      </div>
    </div>
  );

  return (
    <>
      {!externalReference && !!children
        ? cloneElement(children, cloneProps)
        : children}
      {isOpen && isMounted ? (
        usePortal ? (
          <FloatingPortal>{renderTooltip()}</FloatingPortal>
        ) : (
          renderTooltip()
        )
      ) : null}
    </>
  );
}
