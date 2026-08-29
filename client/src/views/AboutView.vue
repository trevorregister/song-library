<script setup>
import { Globe, GitBranch, Briefcase, Coffee } from '@lucide/vue'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const links = [
  { label: 'Website', href: 'https://www.trevorregister.com/', icon: Globe },
  { label: 'GitHub', href: 'https://github.com/trevorregister', icon: GitBranch },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/trevor-j-register', icon: Briefcase },
  { label: 'Buy me a coffee', href: 'https://buymeacoffee.com/trevorregister', icon: Coffee },
]
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-semibold mb-1">About</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>What this is</CardTitle>
      </CardHeader>
      <CardContent class="space-y-2 text-muted-foreground">
        <p>
          Song Library retrieves chord charts from Ultimate Guitar and
          Songsterr and lays the chords out directly above the lyrics they
          belong to, then renders each one as a clean, printable PDF. Along
          the way it strips out the ads, comments, autoscroll widgets, and
          other page clutter those sites bury the chords in, and condenses
          the result into a tight, consistent two-column layout that fits
          most songs on a single page.
        </p>
        <p>
          Built for musicians who want a real songbook, not a printout of a
          cluttered tab site. Everything is saved to a folder you choose, so
          your library lives on your own machine.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Who made this</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-muted-foreground">
          Built by Trevor Register — musician, physics educator, and web
          developer.
        </p>
        <div class="flex flex-wrap gap-4">
          <a
            v-for="link in links"
            :key="link.href"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <component :is="link.icon" class="size-4" />
            {{ link.label }}
          </a>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
