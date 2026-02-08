<template>
    <div class="ob">
      <!-- header -->
      <div class="ob__head">
        <div class="ob__title">
          <span class="ob__badge">DEPTH</span>
          <span class="ob__name">订单簿</span>
        </div>
  
        <div class="ob__meta">
          <div class="ob__metaRow">
            <span class="k">Wallet</span>
            <span class="v mono">{{ short(walletAddress) }}</span>
          </div>
          <div class="ob__metaRow">
            <span class="k">Base</span>
            <span class="v mono">{{ short(baseAddress) }}</span>
          </div>
          <div class="ob__metaRow">
            <span class="k">Symbol</span>
            <span class="v mono">{{ baseSymbol || "—" }}</span>
          </div>
        </div>
      </div>
  
      <!-- column header -->
      <div class="ob__cols">
        <div class="c price">价格(USDT)</div>
        <div class="c amount">数量({{ baseSymbol || "—" }})</div>
      </div>
  
      <!-- sells (ask) -->
      <div class="ob__side ob__side--sell">
        <div v-for="(r, i) in asks" :key="'ask-' + i" class="ob__row">
          <div class="ob__bar ob__bar--sell" :style="{ width: r.bar + '%' }"></div>
  
          <div class="cell price sell">{{ fmt(r.p, 6) }}</div>
          <div class="cell amount">{{ fmt(r.a, 6) }}</div>
        </div>
      </div>
  
      <!-- mid price -->
      <div class="ob__mid">
        <div class="ob__midLeft">
          <span class="lbl">最新</span>
          <span class="px" :class="midUp ? 'up' : 'down'">
            {{ fmt(midPrice, 6) }}
          </span>
        </div>
        <div class="ob__midRight">
          <span class="chip">Ask x5</span>
          <span class="dot"></span>
          <span class="chip">Bid x5</span>
        </div>
      </div>
  
      <!-- buys (bid) -->
      <div class="ob__side ob__side--buy">
        <div v-for="(r, i) in bids" :key="'bid-' + i" class="ob__row">
          <div class="ob__bar ob__bar--buy" :style="{ width: r.bar + '%' }"></div>
  
          <div class="cell price buy">{{ fmt(r.p, 6) }}</div>
          <div class="cell amount">{{ fmt(r.a, 6) }}</div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { computed, ref, watch, onUnmounted } from "vue";
  import { ethers } from "ethers";
  
  const props = defineProps({
    walletAddress: { type: String, default: "" },
    baseAddress: { type: String, default: "" }, // ✅ 父组件传入，赋值到 DOGE
    baseSymbol: { type: String, default: "" },
  });
  
  const { walletAddress, baseAddress, baseSymbol } = props;
  
  /* ====== helpers ====== */
  function short(addr) {
    const a = String(addr || "");
    if (!a || a.length < 10) return a || "—";
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  }
  
  function fmt(x, d = 2) {
    const n = Number(x);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(d);
  }
  
  function withBars(rows) {
    const max = Math.max(0, ...rows.map((r) => Number(r.a) || 0));
    return rows.map((r) => ({
      ...r,
      bar: max > 0 ? Math.min(100, (Number(r.a) / max) * 100) : 0,
    }));
  }
  
  /* ====== DEX config ====== */
  const DEX = "0x887D9Af1241a176107d31Bb3C69787DFff6dbaD8";
  
  // base token address (DOGE) ✅ 来自父组件 props.baseAddress
  const DOGE = computed(() => String(baseAddress || ""));
  
  const DEX_ABI = [
    "function getLastPriceFor(address base) view returns (uint256)",
    "function getOrderBookDepthFor(address base, uint256 topN) view returns (uint256[] bidPrices, uint256[] bidSizes, uint256[] askPrices, uint256[] askSizes)",
  ];
  
  /* ====== state ====== */
  const asks = ref([]); // [{p,a,bar}]
  const bids = ref([]); // [{p,a,bar}]
  const midPrice = ref(0);
  const prevMid = ref(0);
  
  const midUp = computed(() => Number(midPrice.value) >= Number(prevMid.value));
  
  let provider = null;
  let signer = null;
  let dex = null;
  
  let pollTimer = null;
  
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }
  
  function resetView() {
    asks.value = [];
    bids.value = [];
    prevMid.value = midPrice.value || 0;
    midPrice.value = 0;
  }
  
  async function ensureDex() {
    if (dex) return;
    if (!window.ethereum) throw new Error("MetaMask not found");
  
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    dex = new ethers.Contract(DEX, DEX_ABI, signer);
  }
  
  /**
   * ✅ 按你给的 refreshPriceAndDepth() 方式实现：
   * - lastPriceRaw = dex.getLastPriceFor(DOGE)
   * - [bp, bs, ap, asz] = dex.getOrderBookDepthFor(DOGE, 5)
   * - price 用 18 decimals 格式化
   * - size(数量) 默认按 18 decimals 格式化（如果你的 base decimals 不是 18，需要改为实际 decimals）
   */
  async function refreshPriceAndDepth() {
    await ensureDex();
  
    const base = DOGE.value;
    if (!base) return;
  
    const lastPriceRaw = await dex.getLastPriceFor(base);
    const nextMid = Number(ethers.formatUnits(lastPriceRaw || 0n, 18));
  
    prevMid.value = midPrice.value || 0;
    midPrice.value = nextMid;
  
    const [bp, bs, ap, asz] = await dex.getOrderBookDepthFor(base, 5);
  
    const nextBids = bp
      .map((p, i) => ({ p, s: bs[i] }))
      .filter((x) => x.p && x.s)
      .map((x) => ({
        p: Number(ethers.formatUnits(x.p, 18)),
        a: Number(ethers.formatUnits(x.s, 18)),
        bar: 0,
      }));
  
    const nextAsks = ap
      .map((p, i) => ({ p, s: asz[i] }))
      .filter((x) => x.p && x.s)
      .map((x) => ({
        p: Number(ethers.formatUnits(x.p, 18)),
        a: Number(ethers.formatUnits(x.s, 18)),
        bar: 0,
      }));
  
    bids.value = withBars(nextBids);
    asks.value = withBars(nextAsks);
  }
  
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        await refreshPriceAndDepth();
      } catch {
        // ignore
      }
    }, 3000);
  }
  
  /* ====== computed (optional) ====== */
  const bestAsk = computed(() => asks.value?.[asks.value.length - 1]?.p ?? 0);
  const bestBid = computed(() => bids.value?.[0]?.p ?? 0);
  const spread = computed(() => {
    const s = Number(bestAsk.value) - Number(bestBid.value);
    return Number.isFinite(s) ? Math.max(0, s) : 0;
  });
  
  /* ====== auto refresh ====== */
  watch(
    () => [walletAddress, baseAddress],
    async ([w, b]) => {
      stopPolling();
      resetView();
  
      // 没有 wallet/base 不拉取
      if (!w || !b) return;
  
      try {
        await refreshPriceAndDepth();
        startPolling();
      } catch {
        // ignore
      }
    },
    { immediate: true }
  );
  
  onUnmounted(() => stopPolling());
  </script>
  
  <style lang="scss" scoped>
  .ob {
    --bg: #0b0f14;
    --panel2: rgba(255, 255, 255, 0.04);
    --text: rgba(255, 255, 255, 0.92);
    --muted: rgba(255, 255, 255, 0.55);
  
    background: radial-gradient(900px 520px at 15% 0%, rgba(0, 208, 132, 0.12), transparent 55%),
      radial-gradient(820px 520px at 95% 5%, rgba(255, 59, 105, 0.12), transparent 60%), var(--bg);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 14px;
    padding: 14px;
    color: var(--text);
    max-width: 520px;
  }
  
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  
  .ob__head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  
  .ob__title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .ob__badge {
    padding: 4px 8px;
    border-radius: 999px;
    font-weight: 900;
    font-size: 11px;
    letter-spacing: 0.12em;
    background: linear-gradient(90deg, rgba(0, 208, 132, 0.22), rgba(86, 195, 255, 0.16));
    border: 1px solid rgba(255, 255, 255, 0.10);
  }
  
  .ob__name {
    font-size: 15px;
    font-weight: 900;
  }
  
  .ob__meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
  }
  
  .ob__metaRow {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    background: var(--panel2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 10px;
  
    .k {
      font-size: 12px;
      color: var(--muted);
    }
    .v {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.88);
    }
  }
  
  /* column header (2 cols) */
  .ob__cols {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 12px;
    margin-bottom: 10px;
  
    .c {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.55);
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .price {
      text-align: left;
    }
    .amount {
      text-align: right;
    }
  }
  
  .ob__side {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .ob__side--buy {
    margin-top: 10px;
  }
  
  /* row (2 cols) */
  .ob__row {
    position: relative;
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    align-items: center;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
  }
  
  .ob__row:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
  }
  
  /* depth bar */
  .ob__bar {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    opacity: 0.14;
    pointer-events: none;
  }
  
  .ob__bar--sell {
    background: linear-gradient(90deg, transparent 0%, rgba(255, 59, 105, 0.55) 100%);
  }
  
  .ob__bar--buy {
    background: linear-gradient(90deg, transparent 0%, rgba(0, 208, 132, 0.55) 100%);
  }
  
  .cell {
    position: relative;
    z-index: 1;
    font-size: 12px;
    font-weight: 700;
  }
  
  .cell.price {
    text-align: left;
  }
  .cell.amount {
    text-align: right;
    color: rgba(255, 255, 255, 0.82);
    font-weight: 650;
  }
  
  .sell {
    color: rgba(255, 59, 105, 0.95);
  }
  .buy {
    color: rgba(0, 208, 132, 0.95);
  }
  
  /* mid */
  .ob__mid {
    margin: 10px 0;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.10);
    background: rgba(0, 0, 0, 0.30);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  
  .ob__midLeft {
    display: flex;
    align-items: baseline;
    gap: 10px;
  
    .lbl {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.55);
      font-weight: 800;
      letter-spacing: 0.04em;
    }
  
    .px {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.02em;
    }
  
    .px.up {
      color: rgba(0, 208, 132, 0.95);
    }
    .px.down {
      color: rgba(255, 59, 105, 0.95);
    }
  }
  
  .ob__midRight {
    display: flex;
    align-items: center;
    gap: 10px;
  
    .chip {
      font-size: 11px;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.78);
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.10);
    }
  
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(86, 195, 255, 0.85);
      box-shadow: 0 0 14px rgba(86, 195, 255, 0.35);
    }
  }
  
  /* footer */
  .ob__foot {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }
  
  .ob__footItem {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 4px;
  
    .k {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.55);
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .v {
      font-size: 13px;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.90);
    }
  }
  </style>