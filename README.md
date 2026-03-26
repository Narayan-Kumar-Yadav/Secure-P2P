# 🛡️ Secure P2P

A premium, decentralized browser-to-browser file sharing and collaboration application. Built with modern web technologies, this app allows users to create secure rooms, chat in real-time, and transfer massive files without relying on a central server for storage.

## ✨ Features

* **True Peer-to-Peer:** Files are streamed directly between browsers using WebRTC data channels. They never touch a central server.
* **End-to-End Encryption (E2EE):** All data transfers and chats are secured via DTLS encryption.
* **No File Size Limits:** Built-in backpressure-safe binary chunking allows for the transfer of massive files (tested up to 3GB) without crashing the browser.
* **Real-Time Collaboration:** Features a live encrypted chat feed alongside file transfers.
* **Rich Media Previews:** In-chat attachment UI with image and video previews, and manual download triggers.
* **Instant QR Joining:** Generate a room link and QR code to instantly connect mobile or desktop peers.
* **Glassmorphism UI:** A sleek, dark-themed, highly responsive user interface.

## 🛠️ Tech Stack

**Frontend:**
* [Next.js](https://nextjs.org/) (React Framework)
* [Tailwind CSS](https://tailwindcss.com/) (Styling & Glassmorphism)
* [Zustand](https://zustand-demo.pmnd.rs/) (State Management)
* [Framer Motion](https://www.framer.com/motion/) (Animations)
* [Simple-Peer](https://github.com/feross/simple-peer) (WebRTC Abstraction)

**Signaling Backend:**
* [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
* [Socket.io](https://socket.io/) (WebSockets for WebRTC Handshakes)

## 🚀 Getting Started (Local Development)

This project uses a root workspace to run both the frontend and backend simultaneously.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/Narayan-Kumar-Yadav/Secure-P2P.git](https://github.com/Narayan-Kumar-Yadav/Secure-P2P.git)
   cd Secure-P2P
   ```

2. Install dependencies for the root, frontend, and backend:
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   cd ..
   ```

3. Start the development servers:
   ```bash
   npm run dev
   ```
   *This uses `concurrently` to launch the Next.js frontend on `http://127.0.0.1:3000` and the Node.js signaling server on port `4000`.*

## 🤝 Author
**Narayan Kumar Yadav**
