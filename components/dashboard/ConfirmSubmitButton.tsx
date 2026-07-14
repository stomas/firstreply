"use client";

import { useFormStatus } from "react-dom";

export function ConfirmSubmitButton({
  label,
  confirmText,
  className,
}: {
  label: string;
  confirmText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
      className={className}
    >
      {pending ? "Vykdoma…" : label}
    </button>
  );
}
