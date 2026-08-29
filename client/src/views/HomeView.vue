<script setup>
import BulkScrapeForm from '@/components/BulkScrapeForm.vue'
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-semibold mb-1">Song Library</h1>
      <p class="text-muted-foreground">
        Song Library retrieves chord charts from Ultimate Guitar and Songsterr and lays the chords out directly
        above the lyrics they belong to, then renders each one as a clean,
        printable PDF. Along the way it strips out the ads, comments, autoscroll
        widgets, and other page clutter those sites bury the chords in, and
        condenses the result into a tight, consistent two-column layout that
        fits most songs on a single page.
      </p>
      <p class="text-muted-foreground mt-2">
        Built for musicians who want a
        real songbook, not a printout of a cluttered tab site. Everything is
        saved to a folder you choose, so your library lives on your own
        machine.
      </p>
    </div>
    <BulkScrapeForm />
  </div>
</template>
