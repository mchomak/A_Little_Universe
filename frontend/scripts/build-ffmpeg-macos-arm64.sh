#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "Build FFmpeg only on an Apple Silicon Mac; found $(uname -s)/$(uname -m)." >&2
  exit 1
fi

VERSION="8.1.3"
ARCHIVE_NAME="ffmpeg-${VERSION}.tar.xz"
ARCHIVE_SHA256="7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="${FFMPEG_BUILD_CACHE:-${ROOT_DIR}/.cache/ffmpeg-${VERSION}}"
OUTPUT_DIR="${FFMPEG_OUTPUT_DIR:-${ROOT_DIR}/resources/macos-arm64}"
ARCHIVE_PATH="${CACHE_DIR}/${ARCHIVE_NAME}"

mkdir -p "${CACHE_DIR}"
if [[ ! -f "${ARCHIVE_PATH}" ]]; then
  DOWNLOAD_PATH="${ARCHIVE_PATH}.download"
  trap 'rm -f "${DOWNLOAD_PATH}"' EXIT
  curl --fail --location --retry 3 --output "${DOWNLOAD_PATH}" "https://ffmpeg.org/releases/${ARCHIVE_NAME}"
  printf '%s  %s\n' "${ARCHIVE_SHA256}" "${DOWNLOAD_PATH}" | shasum -a 256 --check --status
  mv "${DOWNLOAD_PATH}" "${ARCHIVE_PATH}"
  trap - EXIT
fi
printf '%s  %s\n' "${ARCHIVE_SHA256}" "${ARCHIVE_PATH}" | shasum -a 256 --check

BUILD_DIR="$(mktemp -d "${CACHE_DIR}/build.XXXXXX")"
trap 'rm -rf "${BUILD_DIR}"' EXIT
tar -xJf "${ARCHIVE_PATH}" -C "${BUILD_DIR}"
SOURCE_DIR="${BUILD_DIR}/ffmpeg-${VERSION}"
INSTALL_DIR="${BUILD_DIR}/install"

cd "${SOURCE_DIR}"
./configure \
  --prefix="${INSTALL_DIR}" \
  --arch=aarch64 \
  --enable-static \
  --disable-shared \
  --enable-pic \
  --disable-gpl \
  --disable-nonfree \
  --disable-network \
  --disable-autodetect \
  --disable-debug \
  --disable-doc \
  --disable-ffplay \
  --enable-videotoolbox \
  --enable-audiotoolbox
make -j"$(sysctl -n hw.ncpu)"
make install

mkdir -p "${OUTPUT_DIR}"
install -m 755 "${INSTALL_DIR}/bin/ffmpeg" "${OUTPUT_DIR}/ffmpeg"
install -m 755 "${INSTALL_DIR}/bin/ffprobe" "${OUTPUT_DIR}/ffprobe"
install -m 644 "${SOURCE_DIR}/COPYING.LGPLv2.1" "${OUTPUT_DIR}/COPYING.LGPLv2.1"
install -m 644 "${SOURCE_DIR}/LICENSE.md" "${OUTPUT_DIR}/LICENSE.md"
cp "${ARCHIVE_PATH}" "${OUTPUT_DIR}/${ARCHIVE_NAME}"
cat > "${OUTPUT_DIR}/build-info.txt" <<EOF
FFmpeg ${VERSION}, built from the unmodified upstream source archive.
Source: https://ffmpeg.org/releases/${ARCHIVE_NAME}
SHA-256: ${ARCHIVE_SHA256}
Architecture: Apple arm64
Configure: --arch=aarch64 --enable-static --disable-shared --enable-pic --disable-gpl --disable-nonfree --disable-network --disable-autodetect --disable-debug --disable-doc --disable-ffplay --enable-videotoolbox --enable-audiotoolbox
License profile: LGPL-2.1-or-later; GPL and nonfree components disabled.
EOF
cat > "${OUTPUT_DIR}/THIRD-PARTY-NOTICES.md" <<EOF
# FFmpeg notices

This folder contains FFmpeg ${VERSION}, built from the unmodified official source archive. The archive and its SHA-256 are included alongside the executables. The build uses FFmpeg's default LGPL-2.1-or-later licensing profile; GPL and nonfree components are disabled. It uses Apple's system VideoToolbox and AudioToolbox frameworks and FFmpeg's built-in AAC encoder.

The applicable license text is in COPYING.LGPLv2.1 and LICENSE.md. The complete corresponding source archive is ${ARCHIVE_NAME}. The exact configure options and source digest are in build-info.txt.
EOF

if ! file "${OUTPUT_DIR}/ffmpeg" | grep -q 'arm64'; then
  echo "FFmpeg did not produce an Apple arm64 executable." >&2
  exit 1
fi
lipo -verify_arch arm64 "${OUTPUT_DIR}/ffmpeg"
"${OUTPUT_DIR}/ffmpeg" -hide_banner -version | grep -q "ffmpeg version ${VERSION}"
"${OUTPUT_DIR}/ffprobe" -hide_banner -version | grep -q "ffprobe version ${VERSION}"
"${OUTPUT_DIR}/ffmpeg" -hide_banner -buildconf 2>&1 | grep -q -- '--disable-gpl'
if "${OUTPUT_DIR}/ffmpeg" -hide_banner -L 2>&1 | grep -qi 'GNU General Public License'; then
  echo "The FFmpeg binary reports a GPL license despite the LGPL-only build flags." >&2
  exit 1
fi
"${OUTPUT_DIR}/ffmpeg" -hide_banner -encoders 2>&1 | grep -q 'h264_videotoolbox'
"${OUTPUT_DIR}/ffmpeg" -hide_banner -decoders 2>&1 | grep -Eq 'vp8|vp9|opus'
echo "Built and verified FFmpeg ${VERSION} arm64 in ${OUTPUT_DIR}."
