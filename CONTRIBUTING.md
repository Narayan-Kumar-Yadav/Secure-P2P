# Contributing to Secure P2P

Thank you for your interest in improving Secure P2P.

## Development Principles

- Keep the app privacy-first and peer-to-peer by default
- Preserve the current 1-to-1 signaling flow unless a change is intentionally expanding scope
- Favor resilient browser behavior over clever shortcuts, especially in file transfer code
- Avoid regressions in local Windows development, since that is the primary development environment for this project

## Project Setup

```bash
git clone https://github.com/Narayan-Kumar-Yadav/Secure-P2P.git
cd Secure-P2P
npm install
cd frontend && npm install
cd ../backend && npm install
cd ..
```

Run locally:

```bash
npm run dev
```

## Before Opening a Pull Request

- Make sure the frontend lints successfully:

```bash
cd frontend
npm run lint
```

- Make sure TypeScript passes:

```bash
npx tsc --noEmit
```

- If your change touches the signaling or transfer flow, test:
  - room creation
  - room joining
  - chat send and receive
  - file send and receive
  - disconnect handling

## Coding Expectations

- Keep public behavior predictable and user-friendly
- Prefer clear state transitions over hidden side effects
- Be careful with browser memory usage for file transfer features
- Avoid introducing unnecessary dependencies without a clear benefit

## Pull Request Tips

- Explain what changed
- Explain why it changed
- Mention any manual test steps
- Include screenshots when the UI changes visibly

## Security

If you find a security issue related to signaling, room access, or file transfer behavior, please report it responsibly instead of publishing exploit details immediately.
