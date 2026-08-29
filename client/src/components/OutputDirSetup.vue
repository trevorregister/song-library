<script setup>
import { ref } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useOutputDir } from '@/composables/useOutputDir'

const emit = defineEmits(['saved'])

const { outputDir, setOutputDir } = useOutputDir()

const draft = ref(outputDir.value)
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  if (!draft.value.trim()) {
    error.value = 'Enter a directory path.'
    return
  }

  loading.value = true
  try {
    const res = await fetch('/api/output-dir/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputDir: draft.value.trim() }),
    })
    const data = await res.json()

    if (!res.ok || !data.success) {
      error.value = data.error || 'Could not use that directory.'
      return
    }

    setOutputDir(data.outputDir)
    emit('saved')
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
      <CardTitle>Set an output directory</CardTitle>
      <CardDescription>
        Where should generated PDFs be saved? e.g. /Users/you/Music/Chords
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <form class="flex gap-2" @submit.prevent="onSubmit">
        <Input
          v-model="draft"
          type="text"
          placeholder="/path/to/output"
          :disabled="loading"
        />
        <Button type="submit" :disabled="loading">
          {{ loading ? 'Checking…' : 'Save' }}
        </Button>
      </form>

      <Alert v-if="error" variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>
