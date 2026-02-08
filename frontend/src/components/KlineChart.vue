<template>
  <div class="trading-chart">
    <!-- 时间周期 -->
    <div class="timeframe-selector">
      <button
        v-for="tf in timeframes"
        :key="tf.value"
        :class="['timeframe-btn', { active: active === tf.value }]"
        @click="changeTimeframe(tf.value)"
      >
        {{ tf.label }}
      </button>
    </div>

    <!-- K线 -->
    <div class="chart-container">
      <div v-if="loading" class="loading-overlay">加载中...</div>
      <div id="chart_box" class="chart"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { init } from 'klinecharts'
import axios from 'axios'
// import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  memeId: { type: String, default: '65f123456789abcdef000001' }
})

// const authStore = useAuthStore()

const API_BASE = (
//   authStore.server_ip ||
  'http://localhost:3000' ||
  window.location.origin
).replace(/\/$/, '') + '/api'
// const API_BASE = '/api'

const active = ref('5M')
const loading = ref(false)
let chart = null

const applyChartData = (data) => {
  if (!chart || !data?.length) return
  if (typeof chart.applyNewData === 'function') {
    chart.applyNewData(data)
    return
  }
  if (typeof chart.setData === 'function') {
    chart.setData(data)
    return
  }
  if (typeof chart.updateData === 'function') {
    data.forEach(item => chart.updateData(item))
  }
}

let refreshTimer = null

const startAutoRefresh = () => {
  stopAutoRefresh()
  refreshTimer = setInterval(async () => {
    const data = await fetchKlines(active.value)
    applyChartData(data)
  }, 5000)
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

const changeTimeframe = async (tf) => {
  active.value = tf
  stopAutoRefresh()

  const data = await fetchKlines(tf)
  applyChartData(data)

  startAutoRefresh()
}


const timeframeConfigs = {
  '1M': { label: '1分', interval: '1m' },
  '5M': { label: '5分', interval: '5m' },
  '15M': { label: '15分', interval: '15m' },
  '1H': { label: '1小时', interval: '1h' },
  '1D': { label: '1天', interval: '1d' }
}

const timeframes = Object.entries(timeframeConfigs).map(
  ([value, cfg]) => ({ value, label: cfg.label })
)

const fetchKlines = async (timeframe) => {
  loading.value = true
  try {
    const { interval } = timeframeConfigs[timeframe]
    console.log('in fetchKines: ,', `${API_BASE}/meme/${props.memeId}`)
    const res = await axios.get(
      `${API_BASE}/meme/${props.memeId}`,
      { params: { interval } }
    )
    console.log('url is', `${API_BASE}/meme/${props.memeId}`)
    console.log('res is', res)

    const mapped = res.data.data.map(k => ({
      timestamp: Number(k.timestamp?.time),
      open: Number(k.timestamp?.open),
      high: Number(k.timestamp?.high),
      low: Number(k.timestamp?.low),
      close: Number(k.timestamp?.close),
      volume: Number(k.timestamp?.volume || 0)
    }))

    console.log('[kline data]', {
      memeId: props.memeId,
      timeframe,
      interval,
      count: mapped.length,
      data: mapped
    })

    return mapped
  } finally {
    loading.value = false
  }
}


onMounted(async () => {
  chart = init('chart_box')

  const styles = {
    grid: {
      show: true,
      horizontal: {
        show: true,
        size: 1,
        color: 'rgba(255, 255, 255, 0.1)',
        style: 'dashed'
      },
      vertical: {
        show: true,
        size: 1,
        color: 'rgba(255, 255, 255, 0.1)',
        style: 'dashed'
      }
    },
    // 确保图表充满整个容器
    pane: {
      display: true
    },
    candle: {
      type: 'candle_solid',
      priceMark: {
        show: true,
        high: {
          show: true,
          color: '#666',
          textSize: 10
        },
        low: {
          show: true,
          color: '#666',
          textSize: 10
        }
      },
      tooltip: {
        showRule: 'follow_cross',
        showType: 'standard',
        labels: ['时间', '开', '收', '高', '低', '成交量'],
        values: ({ kLineData }) => {
          return [
            new Date(kLineData.timestamp).toLocaleString(),
            kLineData.open,
            kLineData.close,
            kLineData.high,
            kLineData.low,
            kLineData.volume
          ];
        }
      }
    },
    separator: {
      size: 1,
      color: 'rgba(255, 255, 255, 0.1)'
    }
  };

  chart.setStyles(styles);
  
  if (chart?.createIndicator) {
    chart.createIndicator('VOL')
  }

  const data = await fetchKlines(active.value)
  applyChartData(data)

  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
  if (chart) {
    chart.dispose()
    chart = null
  }
})


watch(() => props.memeId, async () => {
  stopAutoRefresh()
  const data = await fetchKlines(active.value)
  applyChartData(data)
  startAutoRefresh()
})

</script>


<style lang="scss" scoped>
.trading-chart {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #333;

  .price-header {
    margin-bottom: 20px;

    .price-info {
      .current-price {
        font-size: 28px;
        font-weight: bold;
        color: #fff;
        margin-bottom: 12px;

        .price-change {
          font-size: 16px;
          margin-left: 12px;
          font-weight: normal;

          &.positive {
            color: #00d084;
          }

          &.negative {
            color: #ff3b69;
          }
        }
      }

      .price-stats {
        display: flex;
        gap: 24px;

        .stat-item {
          display: flex;
          flex-direction: column;

          .label {
            font-size: 12px;
            color: #888;
            margin-bottom: 4px;
          }

          .value {
            font-size: 14px;
            color: #fff;
            font-weight: 500;
          }
        }
      }
    }
  }

  .timeframe-selector {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
    background: #0d0d0d;
    padding: 4px;
    border-radius: 8px;

    .timeframe-btn {
      padding: 8px 12px;
      background: transparent;
      border: none;
      color: #888;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.05);
      }

      &.active {
        background: #65c281;
        color: #000;
        font-weight: 600;
      }
    }
  }

  .chart-container {
    margin-bottom: 16px;
    height: 550px; /* 固定高度，不再变化 */
    width: 100%; /* 确保容器占满宽度 */
    position: relative;

    .chart {
      width: 100%;
      height: 100%;
      background: #0d0d0d;
      border-radius: 8px;
      display: block; /* 确保块级显示 */
      overflow: hidden; /* 防止溢出 */
    }

    .loading-overlay,
    .error-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(13, 13, 13, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      z-index: 10;
    }

    .loading-spinner {
      color: #65c281;
      font-size: 16px;
      font-weight: 500;
    }

    .error-message {
      color: #ff3b69;
      font-size: 14px;
      margin-bottom: 12px;
      text-align: center;
    }

    .retry-btn {
      padding: 8px 16px;
      background: #65c281;
      color: #000;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s ease;

      &:hover {
        background: #4fa865;
      }
    }
  }

  .indicator-selector {
    margin-top: 16px;
    padding: 12px;
    background: #0d0d0d;
    border-radius: 8px;
    border: 1px solid #333;

    .indicator-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .indicator-label {
        font-size: 12px;
        color: #888;
        font-weight: 600;
        min-width: 60px;
        text-align: left;
      }

      .indicator-btn {
        padding: 6px 12px;
        background: transparent;
        border: 1px solid #333;
        color: #888;
        font-size: 11px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          color: #fff;
          border-color: #555;
          background: rgba(255, 255, 255, 0.05);
        }

        &.active {
          background: #65c281;
          color: #000;
          border-color: #65c281;
          font-weight: 600;
        }
      }
    }
  }
}</style>