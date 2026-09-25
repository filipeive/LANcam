# ADR-005: Electron Native Desktop Application (Linux & Windows)

## Status
**Accepted**

## Date
2026-09-24

## Context
Operators running LANCam on desktop computers (Linux and Windows) require an easy, zero-setup way to run the local signaling and HTTPS server, view system status, obtain QR codes, copy OBS Browser URLs, and manage multi-camera sessions without opening terminal windows or setting up command line Node.js scripts manually.

## Decision
We introduce an **Electron Native Desktop Application (`apps/desktop`)** integrated into the monorepo workspace.

Key features:
1. **Embedded Server Engine**: Boots `@lancam/server` directly inside the Electron main process.
2. **Local Network Scanner**: Automatically discovers and displays local IP addresses (`http://192.168.x.x:3478`, `https://lancam.local:3478`).
3. **System Tray & Window Management**: Native tray icon with quick actions (copy OBS link, view active sessions, toggle HTTPS).
4. **Cross-Platform Installer Packaging**: Native builds using `electron-builder` for:
   - Linux: `.AppImage`, `.deb`
   - Windows: `.exe` installer (NSIS) and portable executable.

## Consequences
- Developers and users can run the web app in browser mode or install a native desktop app on Linux and Windows.
- The web app (`apps/web`) and server (`apps/server`) remain decoupled and lightweight.
- Desktop builds bundle Node.js and Chromium runtime for consistent cross-platform execution.
