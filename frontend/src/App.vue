<template>
  <div class="page">
    <div class="topbar">
      <Wallet />
    </div>

    <KlineChart />
  </div>
</template>

<script setup>
import KlineChart from "./components/KlineChart.vue";
import Wallet from "./components/Wallet.vue";
</script>

<style scoped>
.page {
  padding: 16px;
}

.topbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 12px;
}
</style>
