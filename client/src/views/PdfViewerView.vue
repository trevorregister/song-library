<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ZoomIn, ZoomOut, Maximize, Minimize } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useOutputDir } from '@/composables/useOutputDir'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25
// The PDF's chord/lyric text is tuned small (8pt) to fit a song on one
// printed page — start zoomed in well past 100% so it's readable from
// stand distance without the player having to zoom in themselves first.
const DEFAULT_SCALE = 1.5

const route = useRoute()
const router = useRouter()
const { outputDir } = useOutputDir()

const artist = route.params.artist
const filename = route.params.filename

const loading = ref(true)
const error = ref('')
const scale = ref(DEFAULT_SCALE)
const isFullscreen = ref(false)
const viewerRoot = ref(null)
const pagesContainer = ref(null)

let pdfDoc = null

function buildPdfUrl() {
  const dir = encodeURIComponent(outputDir.value)
  return `/api/library/pdf/${encodeURIComponent(artist)}/${encodeURIComponent(filename)}?outputDir=${dir}`
}

// Renders every page to its own <canvas>, scaled by devicePixelRatio so
// text stays crisp on HiDPI displays rather than just being stretched.
async function renderPages() {
  if (!pdfDoc || !pagesContainer.value) return
  const outputScale = window.devicePixelRatio || 1
  pagesContainer.value.innerHTML = ''

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale.value })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    canvas.className = 'bg-white shadow-md'
    pagesContainer.value.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
    await page.render({ canvasContext: ctx, viewport, transform }).promise
  }
}

async function loadPdf() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(buildPdfUrl())
    if (!res.ok) throw new Error(`Failed to load PDF (HTTP ${res.status})`)
    const data = await res.arrayBuffer()
    pdfDoc = await pdfjsLib.getDocument({ data }).promise
    await renderPages()
  } catch (e) {
    error.value = e.message || 'Could not load this PDF.'
  } finally {
    loading.value = false
  }
}

watch(scale, () => {
  if (pdfDoc) renderPages()
})

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, +(scale.value + SCALE_STEP).toFixed(2))
}

function zoomOut() {
  scale.value = Math.max(MIN_SCALE, +(scale.value - SCALE_STEP).toFixed(2))
}

function goBack() {
  router.push({ name: 'library', query: { artist } })
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
  } else {
    await viewerRoot.value.requestFullscreen()
  }
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === viewerRoot.value
}

// Arrow keys page through the chart without needing to grab a mouse/
// trackpad mid-song.
function onKeydown(e) {
  if (!pagesContainer.value) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault()
    pagesContainer.value.scrollBy({ top: pagesContainer.value.clientHeight * 0.9, behavior: 'smooth' })
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    pagesContainer.value.scrollBy({ top: -pagesContainer.value.clientHeight * 0.9, behavior: 'smooth' })
  }
}

onMounted(() => {
  loadPdf()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="viewerRoot" class="fixed inset-0 z-50 flex flex-col bg-background">
    <div class="flex items-center gap-2 border-b bg-background px-3 py-2 shrink-0">
      <Button variant="ghost" size="icon" aria-label="Back to library" @click="goBack">
        <ArrowLeft class="size-4" />
      </Button>
      <span class="font-medium truncate flex-1">{{ filename }}</span>
      <Button variant="ghost" size="icon" aria-label="Zoom out" :disabled="scale <= MIN_SCALE" @click="zoomOut">
        <ZoomOut class="size-4" />
      </Button>
      <span class="text-xs text-muted-foreground w-10 text-center shrink-0">
        {{ Math.round(scale * 100) }}%
      </span>
      <Button variant="ghost" size="icon" aria-label="Zoom in" :disabled="scale >= MAX_SCALE" @click="zoomIn">
        <ZoomIn class="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        :aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="toggleFullscreen"
      >
        <Minimize v-if="isFullscreen" class="size-4" />
        <Maximize v-else class="size-4" />
      </Button>
    </div>

    <div class="flex-1 min-h-0 relative">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
      <Alert v-else-if="error" variant="destructive" class="m-4">
        <AlertTitle>Couldn't load this PDF</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
      <div
        v-show="!loading && !error"
        ref="pagesContainer"
        class="h-full overflow-auto bg-muted/30 flex flex-col items-center gap-4 p-4"
      ></div>
    </div>
  </div>
</template>
