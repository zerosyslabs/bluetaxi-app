#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const CUSTOMER_PACKAGE = 'com.bluetaxi.booking'
export const DRIVER_PACKAGE = 'com.app.bluetaxi.driver'

const CUSTOMER_APK = /^blue-taxi-v(.+)\.apk$/
const DRIVER_APK = /^blue-taxi-driver-v(.+)\.apk$/
const PLACEHOLDER_BULLET =
  /^(tbd|todo|placeholder|xxx|\.{3}|…|n\/a|coming soon|add notes here|changelog here|item|fix|update|wip)$/i
const MIN_BULLET_CHARS = 16

/**
 * @typedef {'customer' | 'driver'} AppKind
 * @typedef {{ name: string, kind: AppKind, version: string }} ReleaseAsset
 * @typedef {{ ok: true } | { ok: false, errors: string[] }} CheckResult
 */

/**
 * @param {string} tag
 * @returns {string}
 */
export function versionFromTag(tag) {
  const trimmed = tag.trim()
  if (!trimmed.startsWith('v')) {
    throw new Error(`Tag must start with v, got ${tag}`)
  }
  return trimmed.slice(1)
}

/**
 * @param {string} name
 * @returns {ReleaseAsset | { name: string, kind: 'invalid', version: null }}
 */
export function classifyAsset(name) {
  const driver = name.match(DRIVER_APK)
  if (driver) {
    return { name, kind: 'driver', version: driver[1] }
  }
  const customer = name.match(CUSTOMER_APK)
  if (customer) {
    return { name, kind: 'customer', version: customer[1] }
  }
  return { name, kind: 'invalid', version: null }
}

/**
 * Return the text under `heading` until the next heading of the same or higher level.
 *
 * @param {string} body
 * @param {string} heading
 * @returns {string | null}
 */
function sectionAfter(heading, body) {
  const hashes = heading.match(/^#+/)
  if (!hashes) return null
  const level = hashes[0].length
  const lines = body.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return null

  const block = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const next = lines[i].match(/^(#{1,6})\s+/)
    if (next && next[1].length <= level) break
    block.push(lines[i])
  }
  return block.join('\n')
}

/**
 * @param {string} section
 * @param {string} label
 * @returns {string | null}
 */
function fieldValue(section, label) {
  const match = section.match(
    new RegExp(`\\*\\*${label}:\\*\\*\\s+\`?([^\\n\`]+)\`?`, 'i'),
  )
  return match ? match[1].trim() : null
}

/**
 * @param {string} section
 * @returns {string[]}
 */
function changelogBullets(section) {
  const changelog = sectionAfter('### Changelog', section)
  if (changelog === null) return []
  return changelog
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
}

/**
 * @param {string} notes
 * @param {string} tag
 * @param {string[]} assetNames
 * @returns {CheckResult}
 */
export function checkRelease(notes, tag, assetNames) {
  const errors = []
  const body = notes.replace(/\r\n/g, '\n').trim()

  if (!body) {
    return { ok: false, errors: ['Release notes are empty'] }
  }

  let version
  try {
    version = versionFromTag(tag)
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] }
  }

  if (assetNames.length === 0) {
    errors.push('Release must include at least one APK')
  }

  /** @type {Partial<Record<AppKind, ReleaseAsset>>} */
  const byKind = {}

  for (const name of assetNames) {
    const asset = classifyAsset(name)
    if (asset.kind === 'invalid') {
      errors.push(
        `${name} must match blue-taxi-v${version}.apk or blue-taxi-driver-v${version}.apk`,
      )
      continue
    }
    if (asset.version !== version) {
      errors.push(
        `${name} version ${asset.version} must match tag v${version}`,
      )
    }
    if (byKind[asset.kind]) {
      errors.push(`Duplicate ${asset.kind} APK: ${name}`)
      continue
    }
    byKind[asset.kind] = asset
  }

  if (!/^# /m.test(body)) {
    errors.push('Notes need a top-level title (# ...)')
  }

  if (!/^## Install\s*$/m.test(body)) {
    errors.push('Notes need an ## Install section')
  }

  /** @type {Array<[AppKind, string, string]>} */
  const apps = [
    ['customer', '## Customer app', CUSTOMER_PACKAGE],
    ['driver', '## Driver app', DRIVER_PACKAGE],
  ]

  for (const [kind, heading, expectedPackage] of apps) {
    const asset = byKind[kind]
    const section = sectionAfter(heading, body)

    if (!asset) {
      if (section && /### Changelog/.test(section)) {
        errors.push(
          `${heading} has a changelog, but no ${kind} APK is attached`,
        )
      }
      continue
    }

    if (section === null) {
      errors.push(`Notes need a ${heading} section for ${asset.name}`)
      continue
    }

    const file = fieldValue(section, 'File')
    const pkg = fieldValue(section, 'Package')
    const ver = fieldValue(section, 'Version')
    const requires = fieldValue(section, 'Requires')

    if (file !== asset.name) {
      errors.push(
        `${heading} **File:** must be \`${asset.name}\`${file ? ` (got ${file})` : ''}`,
      )
    }
    if (pkg !== expectedPackage) {
      errors.push(
        `${heading} **Package:** must be \`${expectedPackage}\`${pkg ? ` (got ${pkg})` : ''}`,
      )
    }
    if (!ver) {
      errors.push(`${heading} needs **Version:**`)
    } else if (!ver.includes(version)) {
      errors.push(
        `${heading} **Version:** must include ${version} (got ${ver})`,
      )
    }
    if (!requires) {
      errors.push(`${heading} needs **Requires:**`)
    }

    if (!/^### Changelog\s*$/m.test(section)) {
      errors.push(`${heading} needs a ### Changelog section`)
      continue
    }

    const bullets = changelogBullets(section)
    if (bullets.length === 0) {
      errors.push(`${heading} changelog needs at least one bullet`)
      continue
    }

    for (const bullet of bullets) {
      if (bullet.length < MIN_BULLET_CHARS || PLACEHOLDER_BULLET.test(bullet)) {
        errors.push(
          `${heading} changelog bullet is too short or a placeholder: "${bullet}"`,
        )
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

/**
 * @param {string} dir
 * @returns {CheckResult}
 */
export function checkChangelogDir(dir) {
  const errors = []
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()

  if (files.length === 0) {
    return { ok: false, errors: [`No changelog files in ${dir}`] }
  }

  for (const name of files) {
    const tag = name.replace(/\.md$/, '')
    const notes = readFileSync(join(dir, name), 'utf8')
    const filesListed = [...notes.matchAll(/\*\*File:\*\*\s+`([^`]+)`/g)].map(
      (match) => match[1],
    )
    const result = checkRelease(notes, tag, filesListed)
    if (!result.ok) {
      errors.push(`${name}:`)
      for (const error of result.errors) {
        errors.push(`  ${error}`)
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {string | undefined} */
  let tag
  /** @type {string | undefined} */
  let notesFile
  /** @type {string | undefined} */
  let changelogDir
  /** @type {string[]} */
  const assets = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--tag' && next) {
      tag = next
      i += 1
    } else if (arg === '--notes-file' && next) {
      notesFile = next
      i += 1
    } else if (arg === '--changelog-dir' && next) {
      changelogDir = next
      i += 1
    } else if ((arg === '--asset' || arg === '--apk') && next) {
      assets.push(basename(next))
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return { tag, notesFile, changelogDir, assets }
}

function printHelp() {
  console.log(`Check Blue Taxi release notes and APK filenames.

Usage:
  node scripts/check-release.mjs --tag v1.0.0-beta --notes-file changelogs/v1.0.0-beta.md --apk file.apk
  node scripts/check-release.mjs --changelog-dir changelogs
`)
}

function fail(errors) {
  console.error('Release check failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

function main() {
  const { tag, notesFile, changelogDir, assets } = parseArgs(process.argv.slice(2))

  if (changelogDir) {
    const result = checkChangelogDir(changelogDir)
    if (!result.ok) fail(result.errors)
    console.log(`Checked ${changelogDir}`)
    return
  }

  if (!tag || !notesFile) {
    fail(['Need --tag and --notes-file, or --changelog-dir'])
    return
  }

  const notes = readFileSync(notesFile, 'utf8')
  const result = checkRelease(notes, tag, assets)
  if (!result.ok) fail(result.errors)
  console.log(`Release notes and APK names are valid for ${tag}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    fail([error instanceof Error ? error.message : String(error)])
  }
}
