<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from '@lucide/vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const route = useRoute()

const artists = ref([])
const loading = ref(true)
const error = ref('')
const expanded = ref(new Set())

function pdfUrl(artist, filename) {
  return `/api/library/pdf/${encodeURIComponent(artist)}/${encodeURIComponent(filename)}`
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
    const res = await fetch('/api/library')
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
    <div>
      <h1 class="text-2xl font-semibold mb-1">Library</h1>
      <p class="text-muted-foreground">Browse saved chord charts.</p>
    </div>

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
            <button
              type="button"
              class="flex items-center gap-1.5 w-full text-left py-1 px-1 rounded hover:bg-accent"
              @click="toggle(a.artist)"
            >
              <ChevronDown v-if="expanded.has(a.artist)" class="size-4 shrink-0 text-muted-foreground" />
              <ChevronRight v-else class="size-4 shrink-0 text-muted-foreground" />
              <FolderOpen v-if="expanded.has(a.artist)" class="size-4 shrink-0 text-muted-foreground" />
              <Folder v-else class="size-4 shrink-0 text-muted-foreground" />
              <span>{{ a.artist }}/</span>
              <span class="text-xs text-muted-foreground ml-1">
                ({{ a.songs.length }})
              </span>
            </button>

            <ul
              v-if="expanded.has(a.artist)"
              class="ml-3 pl-4 border-l border-border"
            >
              <li v-for="song in a.songs" :key="song.filename">
                <a
                  :href="pdfUrl(a.artist, song.filename)"
                  target="_blank"
                  rel="noopener"
                  class="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-accent hover:underline"
                >
                  <FileText class="size-4 shrink-0 text-muted-foreground" />
                  <span>{{ song.title }}.pdf</span>
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
