import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Preview from './Preview.vue'

createApp(Preview).use(createPinia()).mount('#app')
