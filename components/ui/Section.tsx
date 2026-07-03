import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard section wrapper. `tone="tint"` renders the muted panel background
 * with top/bottom hairlines used throughout the design.
 */
export function Section({
  id,
  children,
  className,
  innerClassName,
  tone = "plain",
  maxWidth = "1100px",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  tone?: "plain" | "tint";
  maxWidth?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 px-6 py-[clamp(64px,9vw,110px)]",
        tone === "tint" && "border-y border-line bg-line-soft",
        className,
      )}
    >
      <div
        className={cn("mx-auto w-full", innerClassName)}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-bold uppercase tracking-[0.08em] text-brand">
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  centered = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        centered ? "mx-auto max-w-[56ch] text-center" : "max-w-[680px]",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-4 text-[17px] leading-relaxed text-ink-soft",
            centered && "mx-auto",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
