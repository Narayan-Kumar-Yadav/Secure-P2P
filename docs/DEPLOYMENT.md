# Deployment Guide

This project has two deployable parts:

- `frontend/` for the Next.js web app
- `backend/` for the Socket.IO signaling server

## Recommended Production Setup

- Frontend: Vercel
- Backend: Render or Railway

This split works best because the frontend is a strong fit for Vercel, while the signaling server benefits from a host that supports a long-running Node process.

## Frontend Deployment

Deploy the `frontend/` directory to Vercel.

### Required Environment Variable

```bash
NEXT_PUBLIC_SIGNALING_SERVER=https://your-signaling-server.example.com
```

Without this variable, the hosted frontend will refuse to initialize the signaling connection outside localhost.

## Backend Deployment

Deploy the `backend/` directory as a Node.js web service.

### Expected Runtime

- Start command:

```bash
npm run start
```

- Default port:

The backend reads `PORT` from the environment and falls back to `4000`.

## Local-First Architecture Reminder

The signaling server does not store files. It only helps two peers find each other and exchange WebRTC setup data. Once connected:

- chat messages go peer-to-peer
- file data goes peer-to-peer
- the backend is not used for file storage

## Suggested Deployment Checklist

1. Push the latest code to GitHub
2. Deploy the backend and copy its public URL
3. Set `NEXT_PUBLIC_SIGNALING_SERVER` in Vercel
4. Deploy the frontend from the `frontend/` directory
5. Verify room creation, join flow, chat, and file transfer
