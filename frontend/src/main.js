import { createApp } from "vue";
import App from "./App.vue";
import DexPlugin from "./plugins/dex";
import router from "./router";

createApp(App).use(DexPlugin).use(router).mount("#app");
