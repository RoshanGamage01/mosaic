#!/usr/bin/env bash
# Downloads a standalone MongoDB server (once) and runs it on port 47017 with a
# data directory inside the repo. Only meant for local development — use your
# own MongoDB in production.
set -euo pipefail

PORT="${MOSAIC_LOCAL_MONGO_PORT:-47017}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT/.mongodb-bin"
DATA_DIR="$ROOT/.mongo-data"
VERSION="${MONGODB_VERSION:-8.0.29}"

detect_target() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "macos"
    return
  fi
  # shellcheck disable=SC1091
  . /etc/os-release 2>/dev/null || true
  case "${ID:-}${VERSION_ID:-}" in
    ubuntu24.04) echo "ubuntu2404" ;;
    ubuntu22.04) echo "ubuntu2204" ;;
    debian12) echo "debian12" ;;
    *) echo "ubuntu2204" ;;
  esac
}

if [[ ! -x "$BIN_DIR/bin/mongod" ]]; then
  ARCH="$(uname -m)"
  [[ "$ARCH" == "arm64" ]] && ARCH="aarch64"
  TARGET="$(detect_target)"
  if [[ "$TARGET" == "macos" ]]; then
    URL="https://fastdl.mongodb.org/osx/mongodb-macos-${ARCH}-${VERSION}.tgz"
  else
    URL="https://fastdl.mongodb.org/linux/mongodb-linux-${ARCH}-${TARGET}-${VERSION}.tgz"
  fi

  echo "Downloading MongoDB ${VERSION} from ${URL}"
  mkdir -p "$BIN_DIR"
  curl -fsSL "$URL" -o "$BIN_DIR/mongodb.tgz"
  tar xzf "$BIN_DIR/mongodb.tgz" --strip-components=1 -C "$BIN_DIR"
  rm "$BIN_DIR/mongodb.tgz"
fi

mkdir -p "$DATA_DIR"
echo "Starting MongoDB on 127.0.0.1:${PORT} (data in ${DATA_DIR})"
exec "$BIN_DIR/bin/mongod" --dbpath "$DATA_DIR" --port "$PORT" --bind_ip 127.0.0.1
