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
}
</style>
