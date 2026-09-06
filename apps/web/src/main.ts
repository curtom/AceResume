import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './styles/base.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.config.errorHandler = (error: unknown) => {
  console.error('Unhandled UI error', error);
};
app.mount('#app');
