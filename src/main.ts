import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@mozaic-ds/tokens/adeo/theme'
import '@mozaic-ds/vue/style.css'

import App from './App.vue'

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
