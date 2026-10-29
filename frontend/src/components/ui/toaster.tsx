import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map(({ id, title, description, variant }) => (
        <div
          key={id}
          className={`rounded-xl border px-4 py-3 shadow-lg text-sm transition-all ${
            variant === "destructive"
              ? "bg-red-600 text-white border-red-700"
              : "bg-white text-slate-900 border-slate-200"
          }`}
        >
          {title && <p className="font-semibold">{title}</p>}
          {description && <p className="mt-0.5 opacity-80">{description}</p>}
        </div>
      ))}
    </div>
  );
}