import { create } from 'zustand';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = createId();

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        get().dismissToast(id);
      }, 3800);
    }
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
