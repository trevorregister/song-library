<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const artists = ref([])
const loading = ref(true)
const error = ref('')

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
      <p class="text-muted-foreground">Browse saved chord charts by artist.</p>
    </div>

    <Alert v-if="error" variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <p v-else-if="!loading && artists.length === 0" class="text-sm text-muted-foreground">
      No PDFs yet — generate one from the Home page.
    </p>

    <p v-else-if="loading" class="text-sm text-muted-foreground">Loading…</p>

    <div v-else class="grid gap-3 sm:grid-cols-2">
      <RouterLink
        v-for="a in artists"
        :key="a.artist"
        :to="`/library/${encodeURIComponent(a.artist)}`"
      >
        <Card class="hover:bg-accent transition-colors">
          <CardHeader>
            <CardTitle class="text-base">{{ a.artist }}</CardTitle>
            <CardDescription>
              {{ a.songs.length }} song{{ a.songs.length === 1 ? '' : 's' }}
            </CardDescription>
          </CardHeader>
        </Card>
      </RouterLink>
    </div>
  </div>
</template>
