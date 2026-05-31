import { Button } from "@/components/ui/Button";

type ModalProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onClose: () => void;
};

export function Modal({ actionLabel = "Close", message, onClose, title }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-indigo-950/45 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
        <h2 className="text-2xl font-black text-slate-900">{title}</h2>
        <p className="mt-3 leading-7 text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>{actionLabel}</Button>
        </div>
      </section>
    </div>
  );
}

