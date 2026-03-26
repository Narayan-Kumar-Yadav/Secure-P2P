"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import {
  Activity,
  AlertCircle,
  Copy,
  Download,
  File as FileIcon,
  Fingerprint,
  MessagesSquare,
  Send,
  Share2,
  ShieldCheck,
  TerminalSquare,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { useStore } from '../store/useStore';
import { useToastStore } from '../store/useToastStore';
import { useWebRTC } from '../hooks/useWebRTC';

const ROOM_CODE_LENGTH = 6;

const getLogClasses = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes('connected successfully') || normalized.includes('download complete')) {
    return 'border-emerald-500 text-emerald-400';
  }

  if (
    normalized.includes('error') ||
    normalized.includes('unable') ||
    normalized.includes('disconnected') ||
    normalized.includes('failed')
  ) {
    return 'border-red-500 text-red-400';
  }

  if (
    normalized.includes('receiving') ||
    normalized.includes('chunk') ||
    normalized.includes('reassembling')
  ) {
    return 'border-amber-500 text-amber-300';
  }

  if (normalized.includes('room') || normalized.includes('peer') || normalized.includes('signal')) {
    return 'border-sky-500 text-sky-300';
  }

  return 'border-white/20 text-white/70';
};

const formatChatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

export default function Home() {
  const {
    roomId,
    roomStatus,
    localPeerId,
    displayName,
    setDisplayName,
    error,
    logs,
    chatMessages,
    incomingFile,
    isTransferring,
    transferDirection,
    senderProgress,
    receiverProgress,
    outgoingFileName,
    outgoingFileSize,
  } = useStore();
  const { createRoom, joinRoom, sendMessage, sendFile, isConnected } = useWebRTC();
  const pushToast = useToastStore((state) => state.pushToast);

  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [nameInput, setNameInput] = useState(displayName);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAutoJoinedFromLink = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  const activeTransferName =
    transferDirection === 'receiving' ? incomingFile?.name ?? null : outgoingFileName;
  const activeTransferSize =
    transferDirection === 'receiving' ? incomingFile?.size ?? null : outgoingFileSize;
  const activeTransferProgress =
    transferDirection === 'receiving' ? receiverProgress : senderProgress;
  const activeTransferLabel = transferDirection === 'receiving' ? 'Receiving' : 'Sending';
  const isImagePreview = Boolean(selectedFile?.type.startsWith('image/'));
  const isVideoPreview = Boolean(selectedFile?.type.startsWith('video/'));
  const hasMediaPreview = Boolean(previewUrl && (isImagePreview || isVideoPreview));
  const roomShareUrl =
    roomId && typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomId}` : '';

  useEffect(() => {
    if (hasAutoJoinedFromLink.current || typeof window === 'undefined') {
      return;
    }

    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    hasAutoJoinedFromLink.current = true;

    if (!roomFromUrl) {
      return;
    }

    const normalizedCode = roomFromUrl.trim().toUpperCase();

    if (normalizedCode.length === ROOM_CODE_LENGTH) {
      joinRoom(normalizedCode);
    }
  }, [joinRoom]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedName = window.localStorage.getItem('p2p-display-name');

    if (savedName) {
      setDisplayName(savedName);
    }
  }, [setDisplayName]);

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('p2p-display-name', displayName);
  }, [displayName]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    if (joinCode.trim().length === ROOM_CODE_LENGTH) {
      joinRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  const handleDisplayNameSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedName = nameInput.trim().slice(0, 24) || 'Guest';

    setDisplayName(normalizedName);
    setNameInput(normalizedName);
    pushToast({
      title: 'Name updated',
      description: `You will appear as ${normalizedName} in the chat.`,
      tone: 'success',
    });
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      setSelectedFileWithPreview(event.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFileWithPreview(event.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const sizeUnits = ['Bytes', 'KB', 'MB', 'GB'];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    const formattedSize = bytes / Math.pow(1024, unitIndex);

    return `${formattedSize.toFixed(2)} ${sizeUnits[unitIndex]}`;
  };

  const setSelectedFileWithPreview = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }

    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFileWithPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSend = () => {
    if (selectedFile) {
      sendFile(selectedFile);
      clearSelectedFile();
    }
  };

  const openShareSheet = () => {
    if (!roomShareUrl) {
      return;
    }

    setIsShareOpen(true);
  };

  const copyRoomLink = async () => {
    if (!roomShareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomShareUrl);
      pushToast({
        title: 'Link copied',
        description: 'Room link copied to the clipboard.',
        tone: 'success',
      });
    } catch {
      pushToast({
        title: 'Copy failed',
        description: 'Clipboard access is unavailable in this browser.',
        tone: 'error',
      });
    }
  };

  const displayNameEditor = (
    <form
      onSubmit={handleDisplayNameSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-2 text-left">
        <span className="text-[11px] uppercase tracking-[0.22em] text-white/45">Display Name</span>
        <input
          type="text"
          value={nameInput}
          maxLength={24}
          onChange={(event) => setNameInput(event.target.value)}
          placeholder="Guest"
          className="glass-input rounded-xl px-4 py-3 text-sm"
        />
      </label>
      <button
        type="submit"
        className="rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
      >
        Save Name
      </button>
    </form>
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-10%] left-[-10%] h-[40vw] w-[40vw] rounded-full bg-purple-600/20 blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-[-10%] right-[-10%] h-[50vw] w-[50vw] rounded-full bg-indigo-600/20 blur-[120px]"
      />

      <div className="z-10 grid w-full max-w-6xl grid-cols-1 items-start gap-8 xl:grid-cols-[1.4fr_1fr]">
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass flex w-full flex-col gap-6 rounded-3xl p-8"
            >
              <div className="mb-4 space-y-2 text-center">
                <div className="mx-auto mb-4 w-fit rounded-full bg-primary/20 p-3">
                  <Fingerprint className="h-8 w-8 text-primary" />
                </div>
                <h1 className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                  Secure P2P
                </h1>
                <p className="text-sm text-foreground/60">
                  Browser-to-browser file transfers. No size limits, absolute privacy.
                </p>
              </div>

              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              ) : null}

              {displayNameEditor}

              {roomStatus === 'idle' ? (
                <div className="flex flex-col gap-4">
                  <button
                    onClick={createRoom}
                    className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 font-medium text-white shadow-lg transition-all hover:from-indigo-400 hover:to-purple-500 hover:shadow-indigo-500/25 active:scale-[0.98]"
                  >
                    Create Secure Room
                  </button>

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="mx-4 flex-shrink-0 text-xs uppercase tracking-wider text-white/40">
                      or
                    </span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <form onSubmit={handleJoin} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter 6-character code"
                      maxLength={ROOM_CODE_LENGTH}
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      className="glass-input flex-1 rounded-xl bg-transparent px-4 text-center text-lg font-mono tracking-[0.2em] placeholder:text-sm placeholder:tracking-normal"
                    />
                    <button
                      type="submit"
                      disabled={joinCode.trim().length !== ROOM_CODE_LENGTH}
                      className="rounded-xl bg-white/10 px-6 font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                    >
                      Join
                    </button>
                  </form>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4 py-8"
                >
                  <div className="text-sm uppercase tracking-widest text-white/60">Room Code</div>
                  <div className="animate-pulse text-5xl font-mono tracking-[0.2em] text-white">
                    {roomId}
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-primary/80">
                    <Activity className="h-4 w-4 animate-spin" />
                    Waiting for Peer Connection...
                  </p>
                  {roomShareUrl ? (
                    <button
                      type="button"
                      onClick={openShareSheet}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-primary/40 hover:bg-primary/15"
                    >
                      <Share2 className="h-4 w-4 text-primary" />
                      Share Room Link
                    </button>
                  ) : null}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="connected"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass flex w-full flex-col gap-6 rounded-3xl p-8"
            >
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <Users className="h-5 w-5 text-emerald-400" />
                      Connected Room
                    </h2>
                    <p className="mt-1 font-mono text-xs tracking-wider text-white/50">ROOM: {roomId}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {roomShareUrl ? (
                      <button
                        type="button"
                        onClick={openShareSheet}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-medium text-white/85 transition hover:border-primary/40 hover:bg-primary/15"
                      >
                        <Share2 className="h-4 w-4 text-primary" />
                        Share Room
                      </button>
                    ) : null}

                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-300" />
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">
                          E2E Encrypted
                        </div>
                        <div className="text-sm text-emerald-100">
                          DTLS-secured WebRTC data channel
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              ) : null}

              {displayNameEditor}

              <AnimatePresence>
                {isTransferring ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex w-full flex-col gap-3 overflow-hidden rounded-xl border border-primary/30 bg-white/5 p-4"
                  >
                    <div className="flex justify-between text-xs text-white/80">
                      <span className="max-w-[240px] truncate">
                        {activeTransferLabel}: {activeTransferName ?? 'Preparing transfer...'}
                      </span>
                      <span className="font-mono text-primary">{activeTransferProgress}%</span>
                    </div>

                    {activeTransferSize ? (
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                        {formatFileSize(activeTransferSize)}
                      </div>
                    ) : null}

                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-purple-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${activeTransferProgress}%` }}
                        transition={{ ease: 'easeOut', duration: 0.2 }}
                      />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isTransferring && fileInputRef.current?.click()}
                className={`
                  relative flex min-h-[18rem] h-auto cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl py-6 transition-all duration-300
                  ${
                    isDragging
                      ? 'scale-[1.02] border-2 border-dashed border-primary bg-primary/10'
                      : 'border border-dashed border-white/20 bg-white/5 hover:bg-white/10'
                  }
                  ${isTransferring ? 'pointer-events-none opacity-50' : ''}
                `}
              >
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />

                {selectedFile ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex w-full flex-col items-center gap-3 px-6 text-center"
                  >
                    {hasMediaPreview ? (
                      <div className="relative w-full max-w-[280px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/40 shadow-[0_18px_50px_rgba(15,23,42,0.35)]">
                        {isImagePreview ? (
                          <Image
                            src={previewUrl ?? ''}
                            alt={selectedFile.name}
                            width={640}
                            height={640}
                            unoptimized
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <video
                            src={previewUrl ?? ''}
                            className="h-40 w-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        )}
                        <div className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/75">
                          {isImagePreview ? 'Image preview' : 'Video preview'}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-full bg-emerald-500/20 p-3 text-emerald-400">
                        <FileIcon className="h-8 w-8" />
                      </div>
                    )}

                    <div>
                      <p className="max-w-[260px] truncate font-medium text-white/90">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-white/50">{formatFileSize(selectedFile.size)}</p>
                    </div>

                    <div className="mt-1 flex w-full flex-col gap-2 sm:flex-row">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          triggerFileSend();
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/90 px-6 py-2 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary"
                      >
                        Send File <Send className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearSelectedFile();
                        }}
                        className="w-full rounded-lg border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75 transition hover:bg-white/10"
                      >
                        Clear
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <motion.div animate={isDragging ? { y: -5 } : { y: 0 }}>
                      <UploadCloud
                        className={`mb-3 h-10 w-10 ${isDragging ? 'text-primary' : 'text-white/40'}`}
                      />
                    </motion.div>
                    <p className={`text-sm font-medium ${isDragging ? 'text-primary' : 'text-white/60'}`}>
                      {isDragging ? 'Drop file to select' : 'Select or drop a file directly'}
                    </p>
                    <p className="mt-1 px-4 text-center text-xs text-white/30">
                      Backpressure-safe chunk streaming over the encrypted WebRTC data channel.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-6">
          {isConnected ? (
            <div className="glass flex min-h-[420px] flex-col overflow-hidden rounded-3xl">
              <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessagesSquare className="h-4 w-4 text-primary" />
                  <span className="text-xs font-mono tracking-wider text-white/60">
                    Collaboration Feed
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                  Live chat
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5">
                {chatMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/35">
                    The encrypted chat will appear here once messages start flowing.
                  </div>
                ) : (
                  chatMessages.map((message) => {
                    const isOwnMessage = message.senderId === localPeerId;

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                            isOwnMessage
                              ? 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-lg shadow-primary/20'
                              : 'border border-white/10 bg-white/6 text-white/90'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                            <span>{isOwnMessage ? `${message.senderName} (You)` : message.senderName}</span>
                            <span>{formatChatTime(message.timestamp)}</span>
                          </div>
                          {message.messageType === 'file' ? (
                            <div className="mt-3 w-full min-w-[220px] rounded-2xl border border-white/10 bg-black/25 p-3">
                              {message.fileType?.startsWith('image/') && message.fileUrl ? (
                                <div className="relative mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                                  <Image
                                    src={message.fileUrl}
                                    alt={message.fileName ?? 'Shared file'}
                                    width={480}
                                    height={320}
                                    unoptimized
                                    className="h-36 w-full object-cover"
                                  />
                                </div>
                              ) : null}

                              {message.fileType?.startsWith('video/') && message.fileUrl ? (
                                <div className="relative mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                                  <video
                                    src={message.fileUrl}
                                    className="h-36 w-full object-cover"
                                    muted
                                    loop
                                    autoPlay
                                    playsInline
                                  />
                                </div>
                              ) : null}

                              <div className="flex items-start gap-3">
                                <div className="rounded-2xl bg-white/10 p-3 text-primary">
                                  <FileIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold text-white">
                                    {message.fileName ?? 'Shared file'}
                                  </div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                                    {formatFileSize(message.fileSize ?? 0)}
                                  </div>
                                </div>
                              </div>

                              {message.fileUrl && message.fileName ? (
                                <a
                                  href={message.fileUrl}
                                  download={message.fileName}
                                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary/50 hover:bg-primary/20"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-2 break-words text-sm leading-6">{message.text}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-white/10 p-4">
                <input
                  type="text"
                  placeholder="Send an encrypted message..."
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  className="glass-input flex-1 rounded-xl px-4 py-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="flex items-center justify-center rounded-xl bg-primary p-3 text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : null}

          <div
            className={`glass relative flex flex-col overflow-hidden rounded-3xl ${
              isConnected ? 'min-h-[280px]' : 'min-h-[420px]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-4 w-4 text-white/50" />
                <span className="text-xs font-mono tracking-wider text-white/50">WebRTC Terminal</span>
              </div>
              {isConnected ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                  Live
                </span>
              ) : null}
            </div>
            <div className="relative z-10 flex flex-1 flex-col gap-2 overflow-y-auto p-4 font-mono text-xs">
              {logs.length === 0 ? (
                <span className="italic text-white/20">Awaiting connection...</span>
              ) : (
                logs.map((log) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={log.id}
                    className={`border-l-2 pl-2 ${getLogClasses(log.message)}`}
                  >
                    <span className="mr-2 text-white/30">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    {log.message}
                  </motion.div>
                ))
              )}
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 z-20 h-12 w-full bg-gradient-to-t from-background/90 to-transparent" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isShareOpen && roomShareUrl ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setIsShareOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              className="glass relative w-full max-w-md rounded-[2rem] border border-white/10 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.45)]"
            >
              <button
                type="button"
                onClick={() => setIsShareOpen(false)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/6 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="pr-10">
                <div className="text-[11px] uppercase tracking-[0.24em] text-primary/80">Share Room</div>
                <h3 className="mt-2 text-2xl font-semibold text-white">Instant join link</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Scan the QR code or copy the private room link to join this encrypted session instantly.
                </p>
              </div>

              <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <div className="rounded-[1.45rem] bg-white p-4 shadow-[0_16px_45px_rgba(255,255,255,0.08)]">
                  <QRCode
                    value={roomShareUrl}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#111827"
                    style={{ height: 'auto', width: '100%' }}
                  />
                </div>
              </div>

              <div className="mt-4 break-all rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                {roomShareUrl}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={copyRoomLink}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white transition hover:bg-primary/90"
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </button>
                <button
                  type="button"
                  onClick={() => setIsShareOpen(false)}
                  className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 font-medium text-white/80 transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
