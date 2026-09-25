#!/usr/bin/env bash
#
# LANCam — Installation Script
#
# Sets up the complete LANCam environment.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     LANCam — Installation                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not installed."
  echo "   Install Node.js 20+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Found: $(node -v)"
  exit 1
fi

echo "✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "→ Installing dependencies..."
cd "$PROJECT_DIR"
npm install

echo ""
echo "✓ Dependencies installed"

# Setup certificates
echo ""
echo "→ Setting up HTTPS certificates..."
bash "$SCRIPT_DIR/setup-certs.sh"

# Build frontend
echo ""
echo "→ Building frontend..."
npm run build:web 2>/dev/null || echo "⚠  Frontend build skipped (will use dev server)"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     Installation Complete!                    ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Start LANCam:                               ║"
echo "║    npm run dev                               ║"
echo "║                                              ║"
echo "║  Or for production:                          ║"
echo "║    npm run build && npm start                ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
