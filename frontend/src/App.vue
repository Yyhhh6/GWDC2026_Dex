<template>
  <KlineChart memeId="65f123456789abcdef000001" />
  
  <div class="app">
    <OrderBook
      :wallet-address="walletAddress"
      :base-address="baseAddress"
      :base-symbol="baseSymbol"
    />

    <TradingPanel
      :wallet-address="walletAddress"
      :base-address="baseAddress"
      :base-symbol="baseSymbol"
    />

    <LimitOrder
      :wallet-address="walletAddress"
      :base-address="baseAddress"
      :base-symbol="baseSymbol"
    />

    <div class="brand">MemeHub</div>
  </div>
</template>

<script setup>
import { ref } from "vue";

import OrderBook from "./components/OrderBook.vue";
import TradingPanel from "./components/TradingPanel.vue";
import LimitOrder from "./components/LimitOrder.vue";

/**
 * === 全局共享状态（后续可替换为 wallet store / wagmi / web3modal）===
 */
const walletAddress = ref(
  "0xc025e1df5e5d8ea7f79e183390ae34646ffddb9a"
);

const baseAddress = ref(
  "0xd18d98fdFaBE86a7AD0114a9985F75f9FD6992DE"
);

const baseSymbol = ref("DOGE");
</script>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 360px 1fr 420px;
  gap: 16px;
  padding: 16px;
  background: #0b0f14;
  min-height: 100vh;
}

.brand {
  grid-column: 1 / -1;
  margin-top: 12px;
  text-align: center;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.35);
}
</style>
