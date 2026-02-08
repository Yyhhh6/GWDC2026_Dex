<template>
  <div class="page">
    <FrontierBar>
      <Wallet />
    </FrontierBar>

    <RouterView />
  </div>
</template>

<script setup>
import Wallet from "./components/Wallet.vue";
import FrontierBar from "./components/FrontierBar.vue";
import { RouterView } from "vue-router";
</script>

<style scoped>
.page {
	padding: 72px 16px 16px;
  min-height: 100vh;
  background: #070b10;
  color: rgba(255, 255, 255, 0.9);
}
</style>
