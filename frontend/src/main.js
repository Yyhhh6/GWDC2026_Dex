import { createApp } from "vue";
import App from "./App.vue";
import DexPlugin from "./plugins/dex";

createApp(App).use(DexPlugin).mount("#app");
