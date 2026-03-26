import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { useStore } from '../store/useStore';
import { useToastStore } from '../store/useToastStore';

const CHUNK_SIZE = 64 * 1024;
const BUFFER_RETRY_DELAY_MS = 120;
const textDecoder = new TextDecoder();

type PeerTextMessage = {
  type: 'text';
  message: string;
  senderId: string;
  senderName: string;
  timestamp: number;
};

type PeerFileMetaMessage = {
  type: 'file-meta';
  name: string;
  size: number;
  fileType: string;
  totalChunks: number;
  senderId: string;
  senderName: string;
};

type PeerControlMessage = PeerTextMessage | PeerFileMetaMessage;

type CreateRoomResponse =
  | {
      success: true;
      roomId: string;
    }
  | {
      success: false;
      error: string;
    };

type JoinRoomResponse =
  | {
      success: true;
      roomId: string;
      peers: string[];
    }
  | {
      success: false;
      error: string;
    };

type SignalPayload = {
  senderId: string;
  signal: Peer.SignalData;
};

type PeerWithChannel = Peer.Instance & {
  _channel?: RTCDataChannel | null;
};

const createPeerLabel = (peerId: string | null | undefined) =>
  peerId ? `Peer ${peerId.slice(0, 6)}` : 'Peer';

const parseControlMessage = (raw: string): PeerControlMessage | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed.type === 'text' && typeof parsed.message === 'string') {
      const senderId = typeof parsed.senderId === 'string' ? parsed.senderId : 'peer';

      return {
        type: 'text',
        message: parsed.message,
        senderId,
        senderName:
          typeof parsed.senderName === 'string'
            ? parsed.senderName
            : createPeerLabel(senderId),
        timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
      };
    }

    if (
      parsed.type === 'file-meta' &&
      typeof parsed.name === 'string' &&
      typeof parsed.size === 'number' &&
      typeof parsed.fileType === 'string' &&
      typeof parsed.totalChunks === 'number'
    ) {
      const senderId = typeof parsed.senderId === 'string' ? parsed.senderId : 'peer';

      return {
        type: 'file-meta',
        name: parsed.name,
        size: parsed.size,
        fileType: parsed.fileType,
        totalChunks: parsed.totalChunks,
        senderId,
        senderName:
          typeof parsed.senderName === 'string'
            ? parsed.senderName
            : createPeerLabel(senderId),
      };
    }
  } catch {
    return null;
  }

  return null;
};

const normalizeToBytes = (data: unknown): Uint8Array | null => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data.slice(0));
  }

  if (ArrayBuffer.isView(data)) {
    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return Uint8Array.from(view);
  }

  return null;
};

const resolveSignalingServerUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;

    if (hostname === '127.0.0.1' || hostname === 'localhost') {
      return 'http://127.0.0.1:4000';
    }
  }

  return null;
};

export const useWebRTC = () => {
  const {
    setRoomId,
    setLocalPeerId,
    setStatus,
    setRoomStatus,
    setError,
    addLog,
    addChatMessage,
    clearChatMessages,
    startIncomingTransfer,
    incrementIncomingChunk,
    startOutgoingTransfer,
    setOutgoingProgress,
    resetTransfer,
  } = useStore();
  const pushToast = useToastStore((state) => state.pushToast);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const incomingChunksRef = useRef<ArrayBuffer[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const clearIncomingChunks = () => {
    incomingChunksRef.current = [];
  };

  const cleanupPeer = () => {
    if (!peerRef.current) {
      return;
    }

    peerRef.current.destroy();
    peerRef.current = null;
  };

  const clearSessionState = () => {
    setRoomStatus('idle');
    setRoomId(null);
    resetTransfer();
    clearChatMessages();
    remotePeerIdRef.current = null;
    clearIncomingChunks();
  };

  const finalizeIncomingTransfer = () => {
    const currentTransfer = useStore.getState().incomingFile;

    if (!currentTransfer) {
      return;
    }

    addLog(
      `All ${currentTransfer.totalChunks} chunks received. Reassembling ${currentTransfer.name}...`,
    );
    const fileType = currentTransfer.type || 'application/octet-stream';
    const blob = new Blob(incomingChunksRef.current, {
      type: fileType,
    });
    const fileUrl = URL.createObjectURL(blob);
    const senderId = remotePeerIdRef.current ?? 'peer';

    addChatMessage({
      senderId: currentTransfer.senderId ?? senderId,
      senderName: currentTransfer.senderName ?? createPeerLabel(remotePeerIdRef.current),
      messageType: 'file',
      timestamp: Date.now(),
      fileName: currentTransfer.name,
      fileSize: currentTransfer.size,
      fileType,
      fileUrl,
    });
    clearIncomingChunks();
    pushToast({
      title: 'File ready',
      description: currentTransfer.name,
      tone: 'success',
    });
    addLog(`${currentTransfer.name} added to the collaboration feed.`);

    window.setTimeout(() => {
      useStore.getState().resetTransfer();
    }, 1500);
  };

  const handleFatalError = (title: string, description: string) => {
    setError(description);
    pushToast({
      title,
      description,
      tone: 'error',
    });
    addLog(description);
  };

  const handleIncomingControlMessage = (
    raw: string,
    options: {
      logOnUnsupported?: boolean;
    } = {},
  ) => {
    const message = parseControlMessage(raw);

    if (!message) {
      if (options.logOnUnsupported ?? true) {
        addLog('Received an unsupported control message from the peer.');
      }
      return false;
    }

    if (message.type === 'text') {
      addChatMessage({
        senderId: message.senderId,
        senderName: message.senderName,
        messageType: 'text',
        text: message.message,
        timestamp: message.timestamp,
      });
      return true;
    }

    clearIncomingChunks();
    startIncomingTransfer({
      name: message.name,
      size: message.size,
      type: message.fileType,
      totalChunks: message.totalChunks,
      senderId: message.senderId,
      senderName: message.senderName,
    });
    addLog(`Receiving ${message.name} in ${message.totalChunks} chunk(s).`);
    return true;
  };

  useEffect(() => {
    const signalingServerUrl = resolveSignalingServerUrl();

    if (!signalingServerUrl) {
      setStatus('error');
      setError('Signaling server is not configured for this deployment.');
      addLog('Missing NEXT_PUBLIC_SIGNALING_SERVER for non-local deployment.');
      return;
    }

    socketRef.current = io(signalingServerUrl);

    socketRef.current.on('connect', () => {
      const socketId = socketRef.current?.id ?? null;

      setLocalPeerId(socketId);
      setStatus('connected');
      setError(null);
      addLog(`Connected to signaling server as ${socketId}`);
    });

    socketRef.current.on('connect_error', () => {
      setStatus('error');
      handleFatalError('Signaling unavailable', 'Unable to connect to signaling server.');
    });

    socketRef.current.on('disconnect', () => {
      setStatus('error');
      setLocalPeerId(null);
      setIsConnected(false);
      clearSessionState();
      cleanupPeer();
      addLog('Disconnected from signaling server.');
    });

    socketRef.current.on('peer-joined', (peerId: string) => {
      addLog(`Peer joined: ${peerId}. Initiating WebRTC handshake...`);
      pushToast({
        title: 'Peer joined',
        description: 'Negotiating encrypted peer channel...',
        tone: 'info',
      });
      initiatePeerConnection(peerId, true);
    });

    socketRef.current.on('signal', ({ senderId, signal }: SignalPayload) => {
      if (!peerRef.current) {
        addLog(`Received signal from ${senderId}. Starting non-initiator peer...`);
        initiatePeerConnection(senderId, false);
      }

      peerRef.current?.signal(signal);
    });

    socketRef.current.on('peer-disconnected', (peerId: string) => {
      addLog(`Peer ${peerId} disconnected.`);
      pushToast({
        title: 'Peer disconnected',
        description: 'The encrypted session has ended.',
        tone: 'info',
      });
      setIsConnected(false);
      clearSessionState();
      cleanupPeer();
    });

    return () => {
      socketRef.current?.disconnect();
      cleanupPeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = () => {
    if (!socketRef.current) {
      return;
    }

    setStatus('connecting');
    setError(null);
    clearChatMessages();
    socketRef.current.emit('create-room', (response: CreateRoomResponse) => {
      if (response.success) {
        setRoomId(response.roomId);
        setRoomStatus('created');
        addLog(`Room created: ${response.roomId}. Waiting for peer...`);
        return;
      }

      setStatus('error');
      handleFatalError('Room creation failed', response.error);
    });
  };

  const joinRoom = (roomId: string) => {
    if (!socketRef.current) {
      return;
    }

    setStatus('connecting');
    setError(null);
    clearChatMessages();
    socketRef.current.emit('join-room', roomId, (response: JoinRoomResponse) => {
      if (response.success) {
        setRoomId(roomId);
        setRoomStatus('joined');
        addLog(`Successfully joined room: ${roomId}. Waiting for offer signal...`);
        return;
      }

      setStatus('error');
      handleFatalError('Unable to join room', response.error);
    });
  };

  const initiatePeerConnection = (peerId: string, initiator: boolean) => {
    try {
      addLog(`Initializing peer connection (initiator: ${initiator})...`);
      setError(null);
      remotePeerIdRef.current = peerId;

      const peer = new Peer({
        initiator,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      peer.on('signal', (signal: Peer.SignalData) => {
        socketRef.current?.emit('signal', { peerId, signal });
      });

      peer.on('connect', () => {
        setIsConnected(true);
        setStatus('connected');
        setError(null);
        addLog('WebRTC data channel connected successfully.');
        pushToast({
          title: 'Encrypted channel ready',
          description: 'DTLS-backed peer connection is active.',
          tone: 'success',
        });
      });

      peer.on('data', (data: unknown) => {
        if (typeof data === 'string') {
          if (handleIncomingControlMessage(data)) {
            return;
          }
        }

        const bytes = normalizeToBytes(data);

        if (!bytes) {
          addLog('Received an unsupported binary payload from the peer.');
          return;
        }

        if (bytes.byteLength > 0 && bytes[0] === 123) {
          try {
            const decoded = textDecoder.decode(bytes);

            if (handleIncomingControlMessage(decoded, { logOnUnsupported: false })) {
              return;
            }
          } catch {
            // Fall through to regular binary chunk handling.
          }
        }

        const currentTransfer = useStore.getState().incomingFile;

        if (!currentTransfer) {
          addLog('Received a file chunk before metadata. Ignoring chunk.');
          return;
        }

        incomingChunksRef.current.push(Uint8Array.from(bytes).buffer);
        incrementIncomingChunk();

        const latestState = useStore.getState();
        if (
          latestState.incomingFile &&
          latestState.incomingFile.receivedChunks === latestState.incomingFile.totalChunks
        ) {
          finalizeIncomingTransfer();
        }
      });

      peer.on('error', (error: Error) => {
        console.error('Peer error:', error);
        setStatus('error');
        setIsConnected(false);
        clearIncomingChunks();
        resetTransfer();
        handleFatalError('Peer connection error', `Peer connection error: ${error.message}`);
        cleanupPeer();
      });

      peer.on('close', () => {
        setIsConnected(false);
        peerRef.current = null;
        remotePeerIdRef.current = null;
        clearIncomingChunks();
        clearSessionState();
        addLog('Peer connection closed cleanly.');
      });

      peerRef.current = peer;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown peer creation error';
      console.error('Error creating peer', error);
      setStatus('error');
      handleFatalError('Peer setup failed', `Error creating peer: ${message}`);
    }
  };

  const sendControlMessage = (message: PeerControlMessage) => {
    peerRef.current?.send(JSON.stringify(message));
  };

  const sendMessage = (message: string) => {
    if (peerRef.current && isConnected) {
      const currentState = useStore.getState();
      const senderId = currentState.localPeerId ?? socketRef.current?.id ?? 'self';
      const senderName = currentState.displayName;
      const timestamp = Date.now();

      sendControlMessage({
        type: 'text',
        message,
        senderId,
        senderName,
        timestamp,
      });
      addChatMessage({
        senderId,
        senderName,
        messageType: 'text',
        text: message,
        timestamp,
      });
      return;
    }

    pushToast({
      title: 'Message not sent',
      description: 'The peer connection is not ready yet.',
      tone: 'error',
    });
    addLog('Cannot send message: WebRTC peer not connected.');
  };

  const sendFile = (file: File) => {
    if (!peerRef.current || !isConnected) {
      pushToast({
        title: 'File not sent',
        description: 'The peer connection is not ready yet.',
        tone: 'error',
      });
      addLog('Cannot send file: WebRTC peer not connected.');
      return;
    }

    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const currentState = useStore.getState();
    const senderId = currentState.localPeerId ?? socketRef.current?.id ?? 'self';
    const senderName = currentState.displayName;
    const metadata: PeerFileMetaMessage = {
      type: 'file-meta',
      name: file.name,
      size: file.size,
      fileType: file.type,
      totalChunks,
      senderId,
      senderName,
    };

    startOutgoingTransfer({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    addLog(`Preparing ${file.name} for transfer in ${totalChunks} chunk(s).`);
    sendControlMessage(metadata);

    let currentChunk = 0;

    const readAndSendNextChunk = () => {
      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const reader = new FileReader();

      const sendPreparedChunk = (arrayBuffer: ArrayBuffer) => {
        const activePeer = peerRef.current as PeerWithChannel | null;

        if (!activePeer || !activePeer.connected) {
          handleFatalError(
            'Transfer interrupted',
            'Peer disconnected before the file transfer finished.',
          );
          clearIncomingChunks();
          resetTransfer();
          return;
        }

        if (
          activePeer._channel &&
          activePeer._channel.bufferedAmount > 16 * 1024 * 1024
        ) {
          window.setTimeout(() => {
            sendPreparedChunk(arrayBuffer);
          }, BUFFER_RETRY_DELAY_MS);
          return;
        }

        try {
          activePeer.send(arrayBuffer);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown send failure';
          handleFatalError('Chunk send failed', `Unable to send file chunk: ${message}`);
          clearIncomingChunks();
          resetTransfer();
          return;
        }

        currentChunk += 1;

        const nextProgress = Math.floor((currentChunk / totalChunks) * 100);
        const currentProgress = useStore.getState().senderProgress;
        if (nextProgress > currentProgress) {
          setOutgoingProgress(nextProgress);
        }

        if (currentChunk < totalChunks) {
          readAndSendNextChunk();
          return;
        }

        pushToast({
          title: 'Transfer complete',
          description: file.name,
          tone: 'success',
        });
        addLog(`Transfer complete: ${file.name}`);
        const fileUrl = URL.createObjectURL(file);

        addChatMessage({
          senderId,
          senderName,
          messageType: 'file',
          timestamp: Date.now(),
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          fileUrl,
        });
        window.setTimeout(() => {
          useStore.getState().resetTransfer();
        }, 1500);
      };

      reader.onload = () => {
        if (reader.readyState !== FileReader.DONE || !(reader.result instanceof ArrayBuffer)) {
          handleFatalError(
            'Read failed',
            'Unable to read the selected file for transfer.',
          );
          clearIncomingChunks();
          resetTransfer();
          return;
        }

        sendPreparedChunk(reader.result);
      };

      reader.onerror = () => {
        handleFatalError(
          'Read failed',
          `File read error while sending ${file.name}.`,
        );
        clearIncomingChunks();
        resetTransfer();
      };

      reader.readAsArrayBuffer(slice);
    };

    readAndSendNextChunk();
  };

  return {
    createRoom,
    joinRoom,
    sendMessage,
    sendFile,
    isConnected,
  };
};
