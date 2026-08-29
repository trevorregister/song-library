<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const props = defineProps({
  artist: { type: String, required: true },
})

const songs = ref([])
const loading = ref(true)
const error = ref('')
const notFound = ref(false)

function pdfUrl(filename) {
  return `/api/library/pdf/${encodeURIComponent(props.artist)}/${encodeURIComponent(filename)}`
}

async function loadArtist() {
  loading.value = true
  error.value = ''
  notFound.value = false
  try {
    const res = await fetch('/api/library')
    const data = await res.json()

    if (!res.ok || !data.success) {
      error.value = data.error || 'Could not load the library.'
      return
    }

    const entry = data.artists.find((a) => a.artist === props.artist)
    if (!entry) {
      notFound.value = true
      return
    }
    songs.value = entry.songs
  } catch (e) {
    error.value = 'Could not reach the server. Is it running?'
  } finally {
    loading.value = false
  }
}

onMounted(loadArtist)
</script>

<template>
  <div class="space-y-4">
    <RouterLink to="/library" class="text-sm text-muted-foreground underline">
      ← Back to library
    </RouterLink>

    <h1 class="text-2xl font-semibold">{{ artist }}</h1>

    <Alert v-if="error" variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <p v-else-if="notFound" class="text-sm text-muted-foreground">
      No songs found for this artist.
    </p>

    <p v-else-if="loading" class="text-sm text-muted-foreground">Loading…</p>

    <Card v-else>
      <CardHeader>
        <CardTitle class="text-base">Songs</CardTitle>
        <CardDescription>
          Click a song to open its PDF.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul class="divide-y">
          <li v-for="song in songs" :key="song.filename">
            <a
              :href="pdfUrl(song.filename)"
              target="_blank"
              rel="noopener"
              class="block py-2 text-sm hover:underline"
            >
              {{ song.title }}
            </a>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
