#!/bin/sh
# Downloads the two free fonts the posters use (both SIL Open Font License) into ./fonts.
set -e
cd "$(dirname "$0")" && mkdir -p fonts
C=https://cdn.jsdelivr.net/gh/eigilnikolajsen/commit-mono@main/src/fonts/fontlab
curl -sSfL -o fonts/commit-400.otf "$C/CommitMonoV143-400Regular.otf"
curl -sSfL -o fonts/commit-700.otf "$C/CommitMonoV143-700Regular.otf"
curl -sSfL -o fonts/newsreader-400.ttf "https://fonts.gstatic.com/s/newsreader/v26/cY9qfjOCX1hbuyalUrK49dLac06G1ZGsZBtoBCzBDXXD9JVF438weI_ADA.ttf"
echo "fonts ready"
