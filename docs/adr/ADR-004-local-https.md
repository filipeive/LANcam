# ADR-004: Local HTTPS for Secure Context

## Status
**Accepted**

## Date
2026-09-19

## Context

Mobile browsers require a **Secure Context** (HTTPS) to access the camera via `getUserMedia()`. This is a hard requirement — there is no workaround in production.

Since LANCam operates exclusively on a local network without internet, we cannot use Let's Encrypt or any public CA. We need a solution that:

1. Provides valid HTTPS on LAN IP addresses
2. Works with Chrome Android and Safari iOS
3. Doesn't require complex manual setup every time
4. Doesn't depend on internet connectivity

## Decision

Use **mkcert** to create a local Certificate Authority and generate certificates for LAN IP addresses and hostnames.

### Workflow

1. `mkcert -install` — Creates a local CA and installs it in the system trust store
2. `mkcert 192.168.1.x localhost fdevms.local` — Generates certificates
3. Node.js serves HTTPS using these certificates
4. Android phones: Install `rootCA.pem` as a trusted CA certificate

### Quick Testing Fallback

For development without CA installation:
- Chrome Android: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
- Add the LANCam HTTP URL to the exceptions list

## Alternatives Considered

### Self-signed certificates (no CA)
- **Con**: Browsers show scary warnings, camera API may still refuse to work
- **Con**: Must click through warnings on every device, every time

### Reverse proxy (nginx + Let's Encrypt)
- **Con**: Requires internet access for certificate issuance
- **Con**: Requires a public domain name
- **Con**: Violates LAN-first principle

### HTTP-only + Chrome flags
- **Con**: Not a production solution
- **Con**: Every user must configure browser flags

## Consequences

1. First-time setup requires `npm run setup:certs` (automated script)
2. Android phones need one-time CA installation (documented step-by-step)
3. iOS requires profile installation via Settings (documented)
4. Certificates are valid for the machine's current IP — if IP changes, regenerate
5. No internet dependency for certificate operation
