import { create } from 'zustand';

export type UserStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type RoomStatus = 'idle' | 'created' | 'joined';
export type TransferDirection = 'sending' | 'receiving' | null;

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  senderId?: string;
  senderName?: string;
}

export interface IncomingFile extends FileMetadata {
  receivedChunks: number;
}

export interface LogEntry {
  id: string;
  message: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  messageType: 'text' | 'file';
  text?: string;
  timestamp: number;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
}

type ChatMessageDraft = Omit<ChatMessage, 'id' | 'messageType'> & {
  messageType?: ChatMessage['messageType'];
};

interface AppState {
  roomId: string | null;
  localPeerId: string | null;
  displayName: string;
  status: UserStatus;
  roomStatus: RoomStatus;
  error: string | null;
  logs: LogEntry[];
  chatMessages: ChatMessage[];
  incomingFile: IncomingFile | null;
  isTransferring: boolean;
  transferDirection: TransferDirection;
  senderProgress: number;
  receiverProgress: number;
  outgoingFileName: string | null;
  outgoingFileSize: number | null;
  setRoomId: (id: string | null) => void;
  setLocalPeerId: (id: string | null) => void;
  setDisplayName: (name: string) => void;
  setStatus: (status: UserStatus) => void;
  setRoomStatus: (status: RoomStatus) => void;
  setError: (error: string | null) => void;
  addLog: (message: string) => void;
  addChatMessage: (message: ChatMessageDraft) => void;
  clearChatMessages: () => void;
  startIncomingTransfer: (meta: FileMetadata) => void;
  incrementIncomingChunk: () => void;
  startOutgoingTransfer: (file: Pick<FileMetadata, 'name' | 'size' | 'type'>) => void;
  setOutgoingProgress: (progress: number) => void;
  resetTransfer: () => void;
  reset: () => void;
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createLogEntry = (message: string): LogEntry => ({
  id: createId(),
  message,
  timestamp: Date.now(),
});

const sanitizeDisplayName = (value: string) => {
  const normalized = value.trim().slice(0, 24);

  return normalized || 'Guest';
};

const revokeChatFileUrls = (messages: ChatMessage[]) => {
  if (typeof URL === 'undefined') {
    return;
  }

  messages.forEach((message) => {
    if (message.fileUrl) {
      URL.revokeObjectURL(message.fileUrl);
    }
  });
};

export const useStore = create<AppState>((set) => ({
  roomId: null,
  localPeerId: null,
  displayName: 'Guest',
  status: 'idle',
  roomStatus: 'idle',
  error: null,
  logs: [],
  chatMessages: [],
  incomingFile: null,
  isTransferring: false,
  transferDirection: null,
  senderProgress: 0,
  receiverProgress: 0,
  outgoingFileName: null,
  outgoingFileSize: null,

  setRoomId: (id) => set({ roomId: id }),
  setLocalPeerId: (id) => set({ localPeerId: id }),
  setDisplayName: (displayName) => set({ displayName: sanitizeDisplayName(displayName) }),
  setStatus: (status) => set({ status }),
  setRoomStatus: (roomStatus) => set({ roomStatus }),
  setError: (error) => set({ error }),
  addLog: (message) => set((state) => ({ logs: [...state.logs, createLogEntry(message)] })),
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          ...message,
          messageType: message.messageType ?? 'text',
          id: createId(),
        },
      ],
    })),
  clearChatMessages: () =>
    set((state) => {
      revokeChatFileUrls(state.chatMessages);
      return { chatMessages: [] };
    }),

  startIncomingTransfer: (meta) => set({
    incomingFile: {
      ...meta,
      receivedChunks: 0,
    },
    isTransferring: true,
    transferDirection: 'receiving',
    senderProgress: 0,
    receiverProgress: 0,
    outgoingFileName: null,
    outgoingFileSize: null,
  }),

  incrementIncomingChunk: () => set((state) => {
    if (!state.incomingFile) {
      return state;
    }

    const receivedChunks = state.incomingFile.receivedChunks + 1;
    const receiverProgress = Math.round(
      (receivedChunks / state.incomingFile.totalChunks) * 100,
    );

    return {
      incomingFile: {
        ...state.incomingFile,
        receivedChunks,
      },
      receiverProgress,
      isTransferring: true,
      transferDirection: 'receiving',
    };
  }),

  startOutgoingTransfer: (file) => set({
    incomingFile: null,
    isTransferring: true,
    transferDirection: 'sending',
    senderProgress: 0,
    receiverProgress: 0,
    outgoingFileName: file.name,
    outgoingFileSize: file.size,
  }),

  setOutgoingProgress: (senderProgress) => set({
    senderProgress,
    isTransferring: true,
    transferDirection: 'sending',
  }),

  resetTransfer: () => set({
    incomingFile: null,
    isTransferring: false,
    transferDirection: null,
    senderProgress: 0,
    receiverProgress: 0,
    outgoingFileName: null,
    outgoingFileSize: null,
  }),

  reset: () =>
    set((state) => {
      revokeChatFileUrls(state.chatMessages);

      return {
        roomId: null,
        localPeerId: null,
        displayName: state.displayName,
        status: 'idle',
        roomStatus: 'idle',
        error: null,
        logs: [],
        chatMessages: [],
        incomingFile: null,
        isTransferring: false,
        transferDirection: null,
        senderProgress: 0,
        receiverProgress: 0,
        outgoingFileName: null,
        outgoingFileSize: null,
      };
    }),
}));
