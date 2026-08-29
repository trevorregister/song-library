<script setup>
import BulkScrapeForm from '@/components/BulkScrapeForm.vue'
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-semibold mb-1">Song Library</h1>
      <p class="text-muted-foreground">
        Paste Ultimate Guitar chord-tab URLs to save them as PDFs.
      </p>
    </div>
    <BulkScrapeForm />
  </div>
</template>
