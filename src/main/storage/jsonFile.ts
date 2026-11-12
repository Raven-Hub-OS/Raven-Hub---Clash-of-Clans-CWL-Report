import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Reads a JSON document, returning `fallback` when the file is missing or
 * corrupted. Local app state is disposable by design: a broken settings or
 * library file must never prevent the app from starting.
 */
export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })

  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`

  try {
    await writeFile(temp, JSON.stringify(value), 'utf8')
    try {
      await rename(temp, filePath)
    } catch {
      await rm(filePath, { force: true })
      await rename(temp, filePath)
    }
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined)
    throw error
  }
}
