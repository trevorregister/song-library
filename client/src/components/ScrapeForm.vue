<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const url = ref('')
const loading = ref(false)
const result = ref(null)
const error = ref('')

const resultArtist = computed(() => {
  if (!result.value?.path) return null
  const parts = result.value.path.split('/')
  return parts.length >= 2 ? parts[parts.length - 2] : null
})

async function onSubmit() {
  error.value = ''
  result.value = null

  if (!url.value.trim()) {
    error.value = 'Please paste an Ultimate Guitar chord-tab URL.'
    return
  }

  loading.value = true
  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.value.trim() }),
    })
    const data = await res.json()

    if (!res.ok || !data.success) {
      error.value = data.error || 'Something went wrong while generating the PDF.'
      return
    }

    result.value = data
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
      <CardTitle>Scrape a chord chart</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <form class="flex gap-2" @submit.prevent="onSubmit">
        <Input
          v-model="url"
          type="url"
          :disabled="loading"
        />
        <Button type="submit" :disabled="loading">
          {{ loading ? 'Scraping…' : 'Scrape' }}
        </Button>
      </form>

      <Alert v-if="error" variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Alert v-if="result">
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>
          Saved <strong>{{ result.filename }}</strong> to the output directory.
          <div class="text-xs text-muted-foreground mt-1 break-all">{{ result.path }}</div>
          <RouterLink
            v-if="resultArtist"
            :to="{ path: '/library', query: { artist: resultArtist } }"
            class="text-xs underline mt-1 inline-block"
          >
            View in library
          </RouterLink>
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>
