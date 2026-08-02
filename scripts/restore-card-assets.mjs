import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const archivePath = join(root, 'assets', 'card-library', 'inner-work-high-resolution-card-library-v2.zip')
const outputDir = join(root, 'public', 'cards')
const expectedArchiveSha256 = '39250b82f031310c871aa5de8b92c62be2b3e7dab0453af41ec5fdf5d92c75e0'
const expectedTotalBytes = 2749118

try {
  await access(archivePath)
} catch {
  throw new Error(
    'The high-resolution card library is missing. Add assets/card-library/inner-work-high-resolution-card-library-v2.zip before building.',
  )
}

const archive = await readFile(archivePath)
const archiveSha256 = createHash('sha256').update(archive).digest('hex')
if (archiveSha256 !== expectedArchiveSha256) {
  throw new Error(`Card library hash ${archiveSha256} does not match the verified source.`)
}

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })
execFileSync('unzip', ['-q', archivePath, '-d', outputDir], { stdio: 'inherit' })

const expected = [
  ...Array.from({ length: 54 }, (_, index) => join(outputDir, 'strategy', `ST${index + 1}.webp`)),
  ...Array.from({ length: 30 }, (_, index) => join(outputDir, 'need', `FN${index + 1}.webp`)),
  ...Array.from({ length: 21 }, (_, index) => join(outputDir, 'situation', `S${index + 1}.webp`)),
  join(outputDir, 'backs', 'strategy-back.webp'),
  join(outputDir, 'backs', 'need-back.webp'),
  join(outputDir, 'backs', 'situation-back.webp'),
]

let totalBytes = 0
for (const path of expected) {
  const details = await stat(path)
  totalBytes += details.size
  const header = await readFile(path)
  if (header.subarray(0, 4).toString('ascii') !== 'RIFF' || header.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error(`${path} is not a valid WebP card image.`)
  }
}

for (const folder of ['strategy', 'need', 'situation', 'backs']) {
  const unexpected = (await readdir(join(outputDir, folder))).filter((name) => !name.endsWith('.webp'))
  if (unexpected.length > 0) throw new Error(`Unexpected files in ${folder}: ${unexpected.join(', ')}`)
}

if (totalBytes !== expectedTotalBytes) {
  throw new Error(`Card library contains ${totalBytes} image bytes; expected ${expectedTotalBytes}.`)
}

console.log(`Restored and verified ${expected.length} native-resolution card images.`)
