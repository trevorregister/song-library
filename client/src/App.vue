<script setup>
import ScrapeForm from '@/components/ScrapeForm.vue'
</script>

<template>
  <div class="min-h-screen flex items-start justify-center pt-24 px-4">
    <div class="w-full max-w-xl">
      <h1 class="text-2xl font-semibold mb-1">Song Library</h1>
      <p class="text-muted-foreground mb-6">
        Paste an Ultimate Guitar chord-tab URL to save it as a PDF.
      </p>
      <ScrapeForm />
    </div>
  </div>
</template>
