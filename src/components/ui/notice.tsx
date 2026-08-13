import type {
  ComponentPropsWithoutRef,
  ComponentType,
  ReactNode,
  Ref,
  SVGProps,
} from "react";
import {
  semanticToneClasses,
  type SemanticTone,
} from "@/components/ui/semantic";
import { cn } from "@/lib/utils";

export type NoticeTone = Extract<
  SemanticTone,
  "info" | "warning" | "positive" | "negative"
>;

type NoticeIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function Notice({
  tone,
  title,
  icon: Icon,
  actions,
  children,
  className,
  ref,
  ...props
}: Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  tone: NoticeTone;
  title?: ReactNode;
  icon?: NoticeIcon;
  actions?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border p-4 text-sm",
        semanticToneClasses[tone],
        className,
      )}
      {...props}
    >
      <div className={cn(Icon && "flex items-start gap-3")}>
        {Icon ? (
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        ) : null}
        <div className="min-w-0 flex-1">
          {title ? <h2 className="font-semibold">{title}</h2> : null}
          <div className={cn(title && "mt-1")}>{children}</div>
          {actions ? <div className="mt-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
