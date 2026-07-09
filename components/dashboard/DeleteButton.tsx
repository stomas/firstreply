"use client";

type DeleteButtonProps = {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
  renderAs?: "form" | "button";
};

export function DeleteButton({
  action,
  confirmText,
  label = "Ištrinti",
  renderAs = "form",
}: DeleteButtonProps) {
  const className =
    "rounded-lg border border-warn-border bg-white px-4 py-2 text-sm font-bold text-warn-text hover:bg-warn-bg";

  if (renderAs === "button") {
    return (
      <button
        type="submit"
        formAction={action}
        formNoValidate
        onClick={(event) => {
          if (!window.confirm(confirmText)) {
            event.preventDefault();
          }
        }}
        className={className}
      >
        {label}
      </button>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
