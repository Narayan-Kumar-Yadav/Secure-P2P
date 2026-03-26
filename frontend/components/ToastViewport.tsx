"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

const toneClasses = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-400/40',
    accent: 'text-emerald-300',
    glow: 'shadow-[0_18px_55px_rgba(16,185,129,0.18)]',
  },
  info: {
    icon: Info,
    border: 'border-sky-400/40',
    accent: 'text-sky-300',
    glow: 'shadow-[0_18px_55px_rgba(56,189,248,0.16)]',
  },
  error: {
    icon: AlertCircle,
    border: 'border-red-400/40',
    accent: 'text-red-300',
    glow: 'shadow-[0_18px_55px_rgba(248,113,113,0.18)]',
  },
} as const;

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  return (
    <div className="pointer-events-none fixed top-5 right-5 z-50 flex w-full max-w-sm flex-col gap-3 px-4">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = toneClasses[toast.tone];
          const Icon = tone.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, y: -12 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              className={`pointer-events-auto rounded-2xl border bg-black/55 p-4 backdrop-blur-xl ${tone.border} ${tone.glow}`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-full bg-white/6 p-2 ${tone.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{toast.title}</div>
                  {toast.description ? (
                    <div className="mt-1 text-sm text-white/70">{toast.description}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full p-1 text-white/40 transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
