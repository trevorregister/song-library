<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useOutputDir } from '@/composables/useOutputDir'

const { outputDir } = useOutputDir()

function artistFromPath(path) {
  if (!path) return null
  const parts = path.split('/')
  return parts.length >= 2 ? parts[parts.length - 2] : null
}

const urlsText = ref('')
const loading = ref(false)
const results = ref(null)
const error = ref('')

function parseUrls(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function onSubmit() {
  error.value = ''
  results.value = null

  const urls = parseUrls(urlsText.value)
  if (urls.length === 0) {
    error.value = 'Paste at least one Ultimate Guitar chord-tab URL.'
    return
  }

  loading.value = true
  try {
    const res = await fetch('/api/scrape/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, outputDir: outputDir.value }),
    })
    const data = await res.json()

    if (!res.ok || !data.success) {
      error.value = data.error || 'Something went wrong while processing the batch.'
      return
    }

    results.value = data.results
  } catch (e) {
    error.value = 'Could not reach the server. Is it running?'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Bulk generate</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <form class="space-y-3" @submit.prevent="onSubmit">
        <Textarea
          v-model="urlsText"
          rows="6"
          placeholder="https://tabs.ultimate-guitar.com/tab/artist/song-chords-1234&#10;https://tabs.ultimate-guitar.com/tab/artist/other-song-chords-5678"
          :disabled="loading"
        />
        <Button type="submit" :disabled="loading">
          {{ loading ? 'Generating…' : 'Generate all' }}
        </Button>
      </form>

      <Alert v-if="error" variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <div v-if="results" class="space-y-2">
        <p class="text-sm text-muted-foreground">
          {{ results.filter((r) => r.success).length }} of {{ results.length }} succeeded
          <template v-if="results.some((r) => r.duplicate)">
            ({{ results.filter((r) => r.duplicate).length }} already in library)
          </template>
        </p>
        <ul class="space-y-2">
          <li
            v-for="r in results"
            :key="r.url"
            class="text-sm border rounded-md p-3"
            :class="r.success ? 'border-border' : 'border-destructive/50'"
          >
            <div class="font-medium break-all">{{ r.url }}</div>
            <div v-if="r.success" class="text-muted-foreground mt-1">
              <template v-if="r.duplicate">
                Already in library as <strong>{{ r.filename }}</strong>
              </template>
              <template v-else>
                Saved <strong>{{ r.filename }}</strong>
              </template>
              <RouterLink
                v-if="artistFromPath(r.path)"
                :to="{ path: '/library', query: { artist: artistFromPath(r.path) } }"
                class="underline ml-2"
              >
                View in library
              </RouterLink>
            </div>
            <div v-else class="text-destructive mt-1">{{ r.error }}</div>
          </li>
        </ul>
      </div>
    </CardContent>
  </Card>
</template>
