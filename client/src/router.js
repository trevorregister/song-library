import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LibraryView from '@/views/LibraryView.vue'
import ArtistView from '@/views/ArtistView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/library', name: 'library', component: LibraryView },
    {
      path: '/library/:artist',
      name: 'artist',
      component: ArtistView,
      props: true,
    },
  ],
})

export default router
