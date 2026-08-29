<script setup>
import ScrapeForm from '@/components/ScrapeForm.vue'
import BulkScrapeForm from '@/components/BulkScrapeForm.vue'
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-semibold mb-1">Song Library</h1>
      <p class="text-muted-foreground">
        Paste an Ultimate Guitar chord-tab URL to save it as a PDF.
      </p>
    </div>
    <ScrapeForm />
    <BulkScrapeForm />
  </div>
</template>
