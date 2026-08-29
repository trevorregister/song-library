<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b">
      <nav class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
        <RouterLink to="/" class="font-semibold">Song Library</RouterLink>
        <RouterLink
          to="/"
          class="text-sm"
          :class="route.name === 'home' ? 'text-foreground' : 'text-muted-foreground'"
        >
          Home
        </RouterLink>
        <RouterLink
          to="/library"
          class="text-sm"
          :class="route.name === 'library' ? 'text-foreground' : 'text-muted-foreground'"
        >
          Library
        </RouterLink>
      </nav>
    </header>
    <main class="flex justify-center px-4 py-10">
      <div class="w-full max-w-2xl">
        <RouterView :key="route.fullPath" />
      </div>
    </main>
  </div>
</template>
