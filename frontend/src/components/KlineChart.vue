<template>
  <div class="wrap">
    <div ref="chartRef" class="chart"></div>
    <div class="toolbar">
      <select v-model="interval" class="select" @change="loadData">
        <option value="5s">5s</option>
        <option value="1m">1m</option>
        <option value="5m">5m</option>
      </select>
    </div>
    <div v-if="error" class="err">{{ error }}</div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createChart } from "lightweight-charts";
import axios from "axios";

const chartRef = ref(null);
const interval = ref("5s");
const error = ref("");

let chart;
let candleSeries;
let timer;
let resizeObserver;

async function loadData() {
  error.value = "";
  try {
    const res = await axios.get("http://localhost:3000/klines", {
      params: { interval: interval.value },
    });
    if (!candleSeries) return;
    candleSeries.setData(
      (res.data || []).map(k => ({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }))
    );
  } catch (e) {
    error.value = e?.message || "K线数据加载失败（请确认 backend:3000 正在运行）";
  }
}

onMounted(async () => {
  const el = chartRef.value;
  if (!el) return;

  const width = Math.max(1, el.clientWidth || 1);
  const height = 360;

  chart = createChart(el, {
    width,
    height,
    timeScale: { timeVisible: true, secondsVisible: true },
    layout: {
      background: { color: "transparent" },
      textColor: "rgba(255, 255, 255, 0.72)",
      fontSize: 12,
    },
    grid: {
      vertLines: { color: "rgba(255, 255, 255, 0.06)" },
      horzLines: { color: "rgba(255, 255, 255, 0.06)" },
    },
    crosshair: {
      mode: 1,
    },
    rightPriceScale: {
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: true,
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: "#00d084",
    downColor: "#ff3b69",
    borderUpColor: "#00d084",
    borderDownColor: "#ff3b69",
    wickUpColor: "#00d084",
    wickDownColor: "#ff3b69",
  });
  await loadData();

  resizeObserver = new ResizeObserver(entries => {
    const entry = entries?.[0];
    const w = Math.max(1, Math.floor(entry?.contentRect?.width || el.clientWidth || 1));
    chart?.applyOptions({ width: w });
  });
  resizeObserver.observe(el);

  // 每 2.5s 刷新一次
  timer = setInterval(loadData, 2500);
});

onBeforeUnmount(() => {
  clearInterval(timer);
  if (resizeObserver) resizeObserver.disconnect();
  if (chart) chart.remove();
});
</script>

<style scoped>
.wrap {
  position: relative;
  min-height: 360px;
}

.chart {
  width: 100%;
  height: 360px;
}

.toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
}

.select {
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
  font-weight: 700;
  outline: none;
}

.err {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 110, 110, 0.25);
  background: rgba(255, 110, 110, 0.10);
  color: rgba(255, 210, 210, 0.92);
  font-size: 12px;
  max-width: calc(100% - 20px);
  word-break: break-word;
}
</style>
