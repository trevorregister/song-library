import { ref } from 'vue'

const STORAGE_KEY = 'outputDir'

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

// Module-level so every component sharing this composable sees the same
// value — set once (after server-side validation) via setOutputDir.
const outputDir = ref(readStored())

function setOutputDir(value) {
  outputDir.value = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore — the value just won't persist across reloads
  }
}

function clearOutputDir() {
  outputDir.value = ''
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function useOutputDir() {
  return { outputDir, setOutputDir, clearOutputDir }
}
