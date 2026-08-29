import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LibraryView from '@/views/LibraryView.vue'
import AboutView from '@/views/AboutView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/library', name: 'library', component: LibraryView },
    { path: '/about', name: 'about', component: AboutView },
    // Kept for old deep links — the artist view was folded into the
    // library tree, which auto-expands/scrolls to ?artist=... instead.
    {
      path: '/library/:artist',
      redirect: (to) => ({ path: '/library', query: { artist: to.params.artist } }),
    },
  ],
})

export default router
