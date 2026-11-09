#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG=""
NOTES_FILE=""
REPLACE="0"
declare -a APKS=()

usage() {
  cat <<'EOF'
Upload one or more Blue Taxi APKs to a GitHub release.

Changelog notes are required. The checker refuses placeholder text,
wrong filenames, and APKs that are not listed in the notes.

Usage:
  scripts/upload-apk.sh --tag v1.0.0-beta --apk path/to/blue-taxi-v1.0.0-beta.apk
  scripts/upload-apk.sh --tag v1.0.0-beta --notes-file changelogs/v1.0.0-beta.md --apk customer.apk --apk driver.apk

Options:
  --tag            Release tag, for example v1.0.0-beta (required)
  --apk            Path to an APK. Repeat for customer and driver.
  --notes-file     Changelog markdown. Defaults to changelogs/<tag>.md
  --replace        Replace an APK that is already on the release
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --apk)
      APKS+=("${2:-}")
      shift 2
      ;;
    --notes-file)
      NOTES_FILE="${2:-}"
      shift 2
      ;;
    --replace)
      REPLACE="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TAG" ]]; then
  echo "Need --tag" >&2
  usage >&2
  exit 1
fi

if [[ ${#APKS[@]} -eq 0 ]]; then
  echo "Need at least one --apk" >&2
  usage >&2
  exit 1
fi

if [[ -z "$NOTES_FILE" ]]; then
  NOTES_FILE="$ROOT/changelogs/${TAG}.md"
fi

if [[ ! -f "$NOTES_FILE" ]]; then
  echo "Missing changelog: $NOTES_FILE" >&2
  echo "Copy .github/release-template.md to changelogs/${TAG}.md and fill in the notes." >&2
  exit 1
fi

REPO="${GITHUB_REPOSITORY:-zerosyslabs/bluetaxi-app}"

declare -a ASSET_ARGS=()
NEW_NAMES=""
for apk in "${APKS[@]}"; do
  if [[ ! -f "$apk" ]]; then
    echo "APK not found: $apk" >&2
    exit 1
  fi
  if [[ "$apk" != *.apk ]]; then
    echo "Only .apk files can be uploaded: $apk" >&2
    exit 1
  fi
  name="$(basename "$apk")"
  NEW_NAMES="${NEW_NAMES} ${name} "
  ASSET_ARGS+=(--apk "$apk")
done

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  while IFS= read -r existing; do
    [[ -z "$existing" ]] && continue
    case " ${NEW_NAMES} " in
      *" ${existing} "*) ;;
      *) ASSET_ARGS+=(--apk "$existing") ;;
    esac
  done < <(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')
fi

node "$ROOT/scripts/check-release.mjs" --tag "$TAG" --notes-file "$NOTES_FILE" "${ASSET_ARGS[@]}"
TITLE="Blue Taxi ${TAG#v}"

declare -a UPLOAD_FILES=()
for apk in "${APKS[@]}"; do
  name="$(basename "$apk")"
  if [[ "$name" == blue-taxi-driver-* ]]; then
    UPLOAD_FILES+=("${apk}#Blue Taxi driver app (Android APK)")
  else
    UPLOAD_FILES+=("${apk}#Blue Taxi customer app (Android APK)")
  fi
done

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release edit "$TAG" --repo "$REPO" --notes-file "$NOTES_FILE" --title "$TITLE"
  if [[ "$REPLACE" == "1" ]]; then
    gh release upload "$TAG" "${UPLOAD_FILES[@]}" --repo "$REPO" --clobber
  else
    gh release upload "$TAG" "${UPLOAD_FILES[@]}" --repo "$REPO"
  fi
else
  gh release create "$TAG" "${UPLOAD_FILES[@]}" --repo "$REPO" --title "$TITLE" --notes-file "$NOTES_FILE" --latest
fi

if gh workflow run release-gate.yml --repo "$REPO" --field tag="$TAG" >/dev/null 2>&1; then
  echo "Started Release gate for $TAG"
else
  echo "Could not start Release gate. Open Actions and run it on $TAG if the check did not start by itself." >&2
fi

echo "Uploaded to https://github.com/${REPO}/releases/tag/${TAG}"
