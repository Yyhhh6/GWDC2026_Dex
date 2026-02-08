<template>
  <div class="dex-debug">
    <div class="title">DEX Debug</div>

    <div class="row">
      <button class="btn" :disabled="loading" @click="onCall">
        {{ loading ? "调用中..." : "callDex(getOrderBookDepthFor)" }}
      </button>
      <span v-if="error" class="error">{{ error }}</span>
    </div>

    <pre v-if="result" class="result">{{ result }}</pre>

    <div class="hint">
      需要把 ABI 填到 <code>src/abi/dex.abi.json</code>，否则会报 ABI 为空。
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useDex } from "../lib/useDex";

const dex = useDex();

const loading = ref(false);
const error = ref("");
const result = ref("");

async function onCall() {
  error.value = "";
  result.value = "";

  if (!dex) {
    error.value = "dex 未注入：请确认 main.js 已 use(DexPlugin)";
    return;
  }

  loading.value = true;
  try {
    // 注意：参数签名要以你的 ABI 为准。这里先演示调用入口。
    const res = await dex.callDex("getOrderBookDepthFor");
    result.value = typeof res === "string" ? res : JSON.stringify(res, null, 2);
  } catch (e) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.dex-debug {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.title {
  font-weight: 600;
  margin-bottom: 10px;
}

.row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: rgba(255, 110, 110, 0.9);
}

.result {
  margin-top: 10px;
  font-size: 12px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  overflow: auto;
}

.hint {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.8;
}

code {
  background: rgba(0, 0, 0, 0.25);
  padding: 2px 6px;
  border-radius: 6px;
}
</style>
