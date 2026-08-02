import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const archiveDir = join(root, 'assets', 'card-archive')
const outputDir = join(root, 'public', 'cards')
const archivePath = join(root, '.card-assets.tar.gz')
const expectedArchiveBytes = 129113
const expectedChunks = Array.from(
  { length: 22 },
  (_, index) => `cards-${String(index).padStart(2, '0')}.b64`,
)
const expectedAssets = new Map([
  ['strategies.avif', 66788],
  ['needs.avif', 22141],
  ['situations.avif', 31711],
  ['strategy-back.avif', 4251],
  ['need-back.avif', 4281],
  ['situation-back.avif', 4636],
])

const chunks = (await readdir(archiveDir))
  .filter((name) => name.endsWith('.b64'))
  .sort()

if (JSON.stringify(chunks) !== JSON.stringify(expectedChunks)) {
  throw new Error(`Card archive chunk sequence is incomplete. Found: ${chunks.join(', ')}`)
}

const encoded = (
  await Promise.all(chunks.map((name) => readFile(join(archiveDir, name), 'utf8')))
)
  .map((part) => part.trim())
  .join('')
const archive = Buffer.from(encoded, 'base64')

if (archive.byteLength !== expectedArchiveBytes) {
  throw new Error(
    `Card archive has ${archive.byteLength} bytes; expected ${expectedArchiveBytes}.`,
  )
}
if (archive[0] !== 0x1f || archive[1] !== 0x8b) {
  throw new Error('Card archive is not a valid gzip stream.')
}

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })
await writeFile(archivePath, archive)

try {
  execFileSync('tar', ['-xzf', archivePath, '-C', outputDir], { stdio: 'inherit' })

  for (const [name, expectedBytes] of expectedAssets) {
    const path = join(outputDir, name)
    const details = await stat(path)
    if (details.size !== expectedBytes) {
      throw new Error(`${name} has ${details.size} bytes; expected ${expectedBytes}.`)
    }

    const header = await readFile(path)
    const brand = header.subarray(4, 12).toString('ascii')
    if (brand !== 'ftypavif' && brand !== 'ftypavis') {
      throw new Error(`${name} does not contain a valid AVIF file signature.`)
    }
  }

  console.log(`Restored and verified ${expectedAssets.size} card assets.`)
} finally {
  await rm(archivePath, { force: true })
}
