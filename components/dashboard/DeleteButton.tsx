"use client";

type DeleteButtonProps = {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
};

export function DeleteButton({
  action,
  confirmText,
  label = "Ištrinti",
}: DeleteButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-warn-border bg-white px-4 py-2 text-sm font-bold text-warn-text hover:bg-warn-bg"
      >
        {label}
      </button>
    </form>
  );
}
