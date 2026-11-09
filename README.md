# Blue Taxi Android apps

Official Android downloads for [Blue Taxi](https://bluetaxiph.com) while the Google Play listing is in review.

**[Download the latest release](https://github.com/zerosyslabs/bluetaxi-app/releases/latest)**

Install APKs only from this repository. Do not use files from other sites.

## Customer app

| | |
| --- | --- |
| App | Blue Taxi |
| Version | 1.0.0 (30) |
| Package | `com.bluetaxi.booking` |
| File | [blue-taxi-v1.0.0-beta.apk](https://github.com/zerosyslabs/bluetaxi-app/releases/download/v1.0.0-beta/blue-taxi-v1.0.0-beta.apk) |
| Requires | Android 7.0 or later |

### Install on Android

1. Open this page on your phone and download the APK from [Releases](https://github.com/zerosyslabs/bluetaxi-app/releases/latest).
2. Open the downloaded file.
3. If Android asks, allow installs from your browser or Files app.
4. Tap **Install**, then open **Blue Taxi**.

If a previous Blue Taxi build is already installed and Android blocks the update, uninstall that copy first, then install this APK.

## Driver app

| | |
| --- | --- |
| App | Blue Taxi Driver |
| Version | 1.0.0-beta (36) |
| Package | `com.app.bluetaxi.driver` |
| File | [blue-taxi-driver-v1.0.0-beta.apk](https://github.com/zerosyslabs/bluetaxi-app/releases/download/v1.0.0-beta/blue-taxi-driver-v1.0.0-beta.apk) |
| Requires | Android 7.0 or later |

The office creates the driver login. Use the same install steps as the customer app, then open **Blue Taxi Driver**.

## iPhone

iPhone builds stay in TestFlight and the App Store. This repository is Android only.

## Why this repository exists

Google Play has not approved the listing yet. GitHub Releases is the official sideload channel until the store listing is live. APKs are attached to [releases](https://github.com/zerosyslabs/bluetaxi-app/releases). They are not committed to git.

## Upload a new APK

Changelog notes are required. The release check fails if an APK is missing notes, uses a placeholder bullet, or has the wrong filename.

1. Copy `.github/release-template.md` to `changelogs/vVERSION.md`.
2. Fill in the filename, package, version, and changelog bullets for every APK in that release.
3. Commit the changelog.
4. Upload with the script. Do not use a raw `gh release upload`.

```bash
scripts/upload-apk.sh --tag vVERSION \
  --apk /path/to/blue-taxi-vVERSION.apk \
  --apk /path/to/blue-taxi-driver-vVERSION.apk
```

Filenames must match the tag:

| App | Filename |
| --- | --- |
| Customer | `blue-taxi-vVERSION.apk` |
| Driver | `blue-taxi-driver-vVERSION.apk` |

The **Release gate** workflow checks the notes and names on every new upload.
