#!/usr/bin/env bash
#
# LANCam — Certificate Setup Script
#
# Generates HTTPS certificates for local network camera access.
# Requires mkcert for trusted local CA.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CERT_DIR="$PROJECT_DIR/certs"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     LANCam — Certificate Setup               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check for mkcert
if ! command -v mkcert &> /dev/null; then
  echo "⚠  mkcert not found. Installing..."

  if command -v apt &> /dev/null; then
    echo "→ Installing via apt..."
    sudo apt update && sudo apt install -y libnss3-tools
    # Download mkcert binary
    MKCERT_VERSION="v1.4.4"
    MKCERT_URL="https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/mkcert-${MKCERT_VERSION}-linux-amd64"
    sudo wget -q -O /usr/local/bin/mkcert "$MKCERT_URL"
    sudo chmod +x /usr/local/bin/mkcert
  elif command -v brew &> /dev/null; then
    brew install mkcert
  else
    echo "❌ Cannot install mkcert automatically."
    echo "   Please install mkcert manually: https://github.com/FiloSottile/mkcert"
    exit 1
  fi

  echo "✓ mkcert installed"
fi

# Install local CA
echo "→ Installing local CA..."
mkcert -install

# Detect local IPs
LOCAL_IPS=""
for ip in $(hostname -I 2>/dev/null || echo ""); do
  # Only include IPv4 addresses on local subnets
  if [[ "$ip" =~ ^192\.168\. ]] || [[ "$ip" =~ ^10\. ]] || [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]]; then
    LOCAL_IPS="$LOCAL_IPS $ip"
  fi
done

HOSTNAME=$(hostname)

echo ""
echo "Detected network configuration:"
echo "  Hostname: $HOSTNAME"
echo "  Local IPs:$LOCAL_IPS"
echo ""

# Create certs directory
mkdir -p "$CERT_DIR"

# Generate certificates
echo "→ Generating certificates..."
cd "$CERT_DIR"

mkcert -cert-file lancam.pem -key-file lancam-key.pem \
  localhost \
  127.0.0.1 \
  "$HOSTNAME" \
  "${HOSTNAME}.local" \
  $LOCAL_IPS

echo ""
echo "✓ Certificates generated at:"
echo "  Cert: $CERT_DIR/lancam.pem"
echo "  Key:  $CERT_DIR/lancam-key.pem"

# Show CA root location
CA_ROOT=$(mkcert -CAROOT)
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  IMPORTANT: Android Phone Setup              ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  To use camera on your Android phone:        ║"
echo "║                                              ║"
echo "║  1. Copy the CA certificate to your phone:   ║"
echo "║     $CA_ROOT/rootCA.pem"
echo "║                                              ║"
echo "║  2. On Android, go to:                       ║"
echo "║     Settings → Security → Encryption         ║"
echo "║     → Install from storage                   ║"
echo "║     → Select rootCA.pem                      ║"
echo "║                                              ║"
echo "║  3. Or for quick testing, open Chrome on     ║"
echo "║     your phone and navigate to:              ║"
echo "║     chrome://flags                           ║"
echo "║     Search: insecure origins                 ║"
echo "║     Add: http://<your-ip>:3478               ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Copy .env.example to .env if it doesn't exist
if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "✓ Created .env from .env.example"
fi

echo "✓ Certificate setup complete!"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. npm run dev"
echo ""
