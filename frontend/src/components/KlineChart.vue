<template>
  <div ref="chartRef" class="chart"></div>

  <select v-model="interval" @change="loadData">
    <option value="5s">5s</option>
    <option value="1m">1m</option>
    <option value="5m">5m</option>
  </select>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { createChart } from "lightweight-charts";
import axios from "axios";

const chartRef = ref(null);
const interval = ref("5s");

let chart;
let candleSeries;
let timer;

async function loadData() {
  const res = await axios.get("http://localhost:3000/klines", {
    params: { interval: interval.value },
  });

  candleSeries.setData(
    res.data.map(k => ({
      time: k.time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }))
  );
}

onMounted(async () => {
  chart = createChart(chartRef.value, {
    width: 800,
    height: 400,
    timeScale: { timeVisible: true, secondsVisible: true },
  });

  candleSeries = chart.addCandlestickSeries();
  await loadData();

  // 每 2.5s 刷新一次
  timer = setInterval(loadData, 2500);
});

onBeforeUnmount(() => {
  clearInterval(timer);
  chart.remove();
});
</script>

<style scoped>
.chart {
  border: 1px solid #ccc;
}
</style>
