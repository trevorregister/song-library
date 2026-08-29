<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Trash2, Check, X } from '@lucide/vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useOutputDir } from '@/composables/useOutputDir'

const route = useRoute()
const { outputDir } = useOutputDir()

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

const artists = ref([])
const loading = ref(true)
const error = ref('')
const expanded = ref(new Set())

async function openLibraryFolder() {
  deleteError.value = ''
  const err = await window.electronAPI.openOutputDir(outputDir.value)
  if (err) deleteError.value = `Could not open the folder: ${err}`
}

// Deletion is a separate two-step (request → confirm) flow from the load
// state above, so a failed/pending delete never hides the already-loaded
// library behind the top-level error/loading branches.
const pendingDelete = ref(null)
const deleting = ref(false)
const deleteError = ref('')

function isPendingSong(artist, filename) {
  return pendingDelete.value?.type === 'song' &&
    pendingDelete.value.artist === artist &&
    pendingDelete.value.filename === filename
}

function isPendingArtist(artist) {
  return pendingDelete.value?.type === 'artist' && pendingDelete.value.artist === artist
}

function requestDeleteSong(artist, filename) {
  deleteError.value = ''
  pendingDelete.value = { type: 'song', artist, filename }
}

function requestDeleteArtist(artist) {
  deleteError.value = ''
  pendingDelete.value = { type: 'artist', artist }
}

function cancelDelete() {
  pendingDelete.value = null
}

async function confirmDelete() {
  const target = pendingDelete.value
  if (!target) return

  deleting.value = true
  deleteError.value = ''
  try {
    const dir = encodeURIComponent(outputDir.value)
    const url =
      target.type === 'song'
        ? `/api/library/pdf/${encodeURIComponent(target.artist)}/${encodeURIComponent(target.filename)}?outputDir=${dir}`
        : `/api/library/artist/${encodeURIComponent(target.artist)}?outputDir=${dir}`

    const res = await fetch(url, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok || !data.success) {
      deleteError.value = data.error || 'Could not delete that.'
      return
    }

    if (target.type === 'artist') {
      artists.value = artists.value.filter((a) => a.artist !== target.artist)
    } else {
      const artistEntry = artists.value.find((a) => a.artist === target.artist)
      if (artistEntry) {
        artistEntry.songs = artistEntry.songs.filter((s) => s.filename !== target.filename)
        if (artistEntry.songs.length === 0) {
          artists.value = artists.value.filter((a) => a.artist !== target.artist)
        }
      }
    }
    pendingDelete.value = null
  } catch (e) {
    deleteError.value = 'Could not reach the server. Is it running?'
  } finally {
    deleting.value = false
  }
}

function pdfUrl(artist, filename) {
  const dir = encodeURIComponent(outputDir.value)
  return `/api/library/pdf/${encodeURIComponent(artist)}/${encodeURIComponent(filename)}?outputDir=${dir}`
}

function toggle(artist) {
  const next = new Set(expanded.value)
  if (next.has(artist)) {
    next.delete(artist)
  } else {
    next.add(artist)
  }
  expanded.value = next
}

async function loadLibrary() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/library?outputDir=${encodeURIComponent(outputDir.value)}`)
    const data = await res.json()

    if (!res.ok || !data.success) {
      error.value = data.error || 'Could not load the library.'
      return
    }

    artists.value = data.artists

    const target = route.query.artist
    if (target && artists.value.some((a) => a.artist === target)) {
      expanded.value = new Set([target])
      await nextTick()
      document
        .getElementById(`artist-${target}`)
        ?.scrollIntoView({ block: 'center' })
    }
  } catch (e) {
    error.value = 'Could not reach the server. Is it running?'
  } finally {
    loading.value = false
  }
}

onMounted(loadLibrary)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold mb-1">Library</h1>
        <p class="text-muted-foreground">Browse saved chord charts.</p>
      </div>
      <Button v-if="isElectron" variant="outline" size="sm" @click="openLibraryFolder">
        <FolderOpen class="size-4" />
        Open folder
      </Button>
    </div>

    <Alert v-if="deleteError" variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ deleteError }}</AlertDescription>
    </Alert>

    <Alert v-if="error" variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <p v-else-if="!loading && artists.length === 0" class="text-sm text-muted-foreground">
      No PDFs yet — generate one from the Home page.
    </p>

    <p v-else-if="loading" class="text-sm text-muted-foreground">Loading…</p>

    <Card v-else>
      <CardContent>
        <ul class="font-mono text-sm">
          <li v-for="a in artists" :key="a.artist" :id="`artist-${a.artist}`">
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="flex items-center gap-1.5 flex-1 min-w-0 text-left py-1 px-1 rounded hover:bg-accent"
                @click="toggle(a.artist)"
              >
                <ChevronDown v-if="expanded.has(a.artist)" class="size-4 shrink-0 text-muted-foreground" />
                <ChevronRight v-else class="size-4 shrink-0 text-muted-foreground" />
                <FolderOpen v-if="expanded.has(a.artist)" class="size-4 shrink-0 text-muted-foreground" />
                <Folder v-else class="size-4 shrink-0 text-muted-foreground" />
                <span class="truncate">{{ a.artist }}/</span>
                <span class="text-xs text-muted-foreground ml-1 shrink-0">
                  ({{ a.songs.length }})
                </span>
              </button>

              <template v-if="isPendingArtist(a.artist)">
                <span class="text-xs text-muted-foreground shrink-0">Delete artist and all songs?</span>
                <Button size="icon-xs" variant="ghost" class="shrink-0" :disabled="deleting" @click="confirmDelete">
                  <Check class="size-4 text-destructive" />
                </Button>
                <Button size="icon-xs" variant="ghost" class="shrink-0" :disabled="deleting" @click="cancelDelete">
                  <X class="size-4" />
                </Button>
              </template>
              <Button
                v-else
                size="icon-xs"
                variant="ghost"
                class="shrink-0 text-muted-foreground hover:text-destructive"
                title="Delete artist"
                @click="requestDeleteArtist(a.artist)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>

            <ul
              v-if="expanded.has(a.artist)"
              class="ml-3 pl-4 border-l border-border"
            >
              <li v-for="song in a.songs" :key="song.filename" class="flex items-center gap-1">
                <a
                  :href="pdfUrl(a.artist, song.filename)"
                  target="_blank"
                  rel="noopener"
                  class="flex items-center gap-1.5 flex-1 min-w-0 py-1 px-1 rounded hover:bg-accent hover:underline"
                >
                  <FileText class="size-4 shrink-0 text-muted-foreground" />
                  <span class="truncate">{{ song.title }}.pdf</span>
                </a>

                <template v-if="isPendingSong(a.artist, song.filename)">
                  <span class="text-xs text-muted-foreground shrink-0">Delete?</span>
                  <Button size="icon-xs" variant="ghost" class="shrink-0" :disabled="deleting" @click="confirmDelete">
                    <Check class="size-4 text-destructive" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" class="shrink-0" :disabled="deleting" @click="cancelDelete">
                    <X class="size-4" />
                  </Button>
                </template>
                <Button
                  v-else
                  size="icon-xs"
                  variant="ghost"
                  class="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Delete song"
                  @click="requestDeleteSong(a.artist, song.filename)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </li>
            </ul>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
