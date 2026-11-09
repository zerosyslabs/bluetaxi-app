import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkRelease, classifyAsset, versionFromTag } from './check-release.mjs'

const TAG = 'v1.0.0-beta'
const CUSTOMER_APK = 'blue-taxi-v1.0.0-beta.apk'
const DRIVER_APK = 'blue-taxi-driver-v1.0.0-beta.apk'

const validNotes = `# Blue Taxi v1.0.0-beta

Play Store review is still pending.

## Customer app

- **File:** \`blue-taxi-v1.0.0-beta.apk\`
- **Package:** \`com.bluetaxi.booking\`
- **Version:** 1.0.0-beta (30)
- **Requires:** Android 7.0 or later

### Changelog

- Book a taxi as a guest without creating an account
- See estimated fare and booking fee before you confirm

## Driver app

- **File:** \`blue-taxi-driver-v1.0.0-beta.apk\`
- **Package:** \`com.app.bluetaxi.driver\`
- **Version:** 1.0.0-beta (36)
- **Requires:** Android 7.0 or later

### Changelog

- Sign in with the login the office creates
- Booking fee is taken from the driver wallet on accept

## Install

1. Download the APK on your Android phone.
2. Open the file and tap Install.
`

test('versionFromTag strips the v prefix', () => {
  assert.equal(versionFromTag('v1.0.0-beta'), '1.0.0-beta')
})

test('classifyAsset accepts customer and driver filenames', () => {
  assert.deepEqual(classifyAsset(CUSTOMER_APK), {
    name: CUSTOMER_APK,
    kind: 'customer',
    version: '1.0.0-beta',
  })
  assert.deepEqual(classifyAsset(DRIVER_APK), {
    name: DRIVER_APK,
    kind: 'driver',
    version: '1.0.0-beta',
  })
  assert.equal(classifyAsset('app.apk').kind, 'invalid')
})

test('valid notes and both APKs pass', () => {
  const result = checkRelease(validNotes, TAG, [CUSTOMER_APK, DRIVER_APK])
  assert.equal(result.ok, true)
})

test('empty notes fail', () => {
  const result = checkRelease('   ', TAG, [CUSTOMER_APK])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /empty/)
})

test('missing APKs fail', () => {
  const result = checkRelease(validNotes, TAG, [])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /at least one APK/)
})

test('wrong filename fails', () => {
  const result = checkRelease(validNotes, TAG, ['build-123.apk'])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /must match blue-taxi/)
})

test('filename version must match tag', () => {
  const result = checkRelease(validNotes, TAG, ['blue-taxi-v1.0.1.apk'])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /must match tag/)
})

test('customer APK without a customer section fails', () => {
  const notes = `# Title

## Install

1. Download the APK.
`
  const result = checkRelease(notes, TAG, [CUSTOMER_APK])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /Customer app/)
})

test('placeholder changelog bullets fail', () => {
  const notes = validNotes.replace(
    '- Book a taxi as a guest without creating an account\n- See estimated fare and booking fee before you confirm',
    '- TBD',
  )
  const result = checkRelease(notes, TAG, [CUSTOMER_APK, DRIVER_APK])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /placeholder/)
})

test('changelog section without bullets fails', () => {
  const notes = validNotes.replace(
    '### Changelog\n\n- Book a taxi as a guest without creating an account\n- See estimated fare and booking fee before you confirm',
    '### Changelog\n\nComing later.',
  )
  const result = checkRelease(notes, TAG, [CUSTOMER_APK, DRIVER_APK])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /at least one bullet/)
})

test('wrong package name fails', () => {
  const notes = validNotes.replace('com.bluetaxi.booking', 'com.example.app')
  const result = checkRelease(notes, TAG, [CUSTOMER_APK, DRIVER_APK])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /com\.bluetaxi\.booking/)
})

test('File field must match the uploaded APK name', () => {
  const notes = validNotes.replaceAll(CUSTOMER_APK, 'blue-taxi-v9.apk')
  const result = checkRelease(notes, TAG, [CUSTOMER_APK, DRIVER_APK])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /File/)
})

test('driver-only upload does not require a customer section', () => {
  const notes = `# Blue Taxi v1.0.0-beta

## Driver app

- **File:** \`blue-taxi-driver-v1.0.0-beta.apk\`
- **Package:** \`com.app.bluetaxi.driver\`
- **Version:** 1.0.0-beta (36)
- **Requires:** Android 7.0 or later

### Changelog

- Sign in with the login the office creates for this fleet

## Install

1. Download the APK on your Android phone.
`
  const result = checkRelease(notes, TAG, [DRIVER_APK])
  assert.equal(result.ok, true)
})

test('changelog without a matching APK fails', () => {
  const result = checkRelease(validNotes, TAG, [CUSTOMER_APK])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /no driver APK/)
})
