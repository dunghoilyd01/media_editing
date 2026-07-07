import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import VideoEditor from '../views/VideoEditor.vue'
import ImageEditor from '../views/ImageEditor.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/video/:uuid?', name: 'VideoEditor', component: VideoEditor },
  { path: '/image/:uuid?', name: 'ImageEditor', component: ImageEditor },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
