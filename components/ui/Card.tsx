import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
