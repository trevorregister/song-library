import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'theme'

// Defaults to dark unless the user has explicitly chosen light mode.
function getInitialIsDark() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'light'
  } catch {
    return true
  }
}

// Module-level state so every component sharing this composable reflects
// the same toggle, and the `.dark` class (which drives all of shadcn-vue's
// CSS variables) is applied as soon as this module loads, not on first
// component mount.
const isDark = ref(getInitialIsDark())

watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
})

export function useDarkMode() {
  function toggle() {
    isDark.value = !isDark.value
    try {
      localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
    } catch {
      // ignore — theme just won't persist across reloads
    }
  }

  return { isDark, toggle }
}
