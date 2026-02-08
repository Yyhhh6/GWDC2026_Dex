<template>
  <div class="tp">
    <!-- Header -->
    <div class="tp__head">
      <div class="tp__title">
        <div class="tp__badge">WEB3</div>
        <div class="tp__name">Trading Panel</div>
      </div>

      <div class="tp__meta">
        <div class="tp__metaRow">
          <span class="tp__k">Wallet</span>
          <span class="tp__v mono">{{ short(walletAddress) }}</span>
        </div>
        <div class="tp__metaRow">
          <span class="tp__k">Base</span>
          <span class="tp__v mono">{{ short(baseAddress) }}</span>
        </div>
        <div class="tp__metaRow">
          <span class="tp__k">Symbol</span>
          <span class="tp__v mono">{{ baseSymbol || "—" }}</span>
        </div>
      </div>
    </div>

    <!-- Top Tabs: Market / Limit -->
    <div class="tp__tabs">
      <button
        class="tp__tab"
        :class="{ active: orderType === 'market' }"
        @click="orderType = 'market'"
      >
        市价
      </button>
      <button
        class="tp__tab"
        :class="{ active: orderType === 'limit' }"
        @click="orderType = 'limit'"
      >
        限价
      </button>
    </div>

    <!-- Second Tabs: Buy / Sell -->
    <div class="tp__tabs tp__tabs--secondary">
      <button
        class="tp__tab tp__tab--buy"
        :class="{ active: side === 'buy' }"
        @click="side = 'buy'"
      >
        买入
      </button>
      <button
        class="tp__tab tp__tab--sell"
        :class="{ active: side === 'sell' }"
        @click="side = 'sell'"
      >
        卖出
      </button>
    </div>

    <!-- Form -->
    <div class="tp__card">
      <div class="tp__cardHead">
        <div class="tp__pair">
          <span class="tp__pairBase">{{ baseSymbol || "BASE" }}</span>
          <span class="tp__pairSlash">/</span>
          <span class="tp__pairQuote">USDT</span>
        </div>

        <div class="tp__chip" :class="side === 'buy' ? 'buy' : 'sell'">
          {{ side === 'buy' ? 'BUY' : 'SELL' }}
        </div>
      </div>

      <!-- Limit price row (only for limit) -->
      <div v-if="orderType === 'limit'" class="tp__row">
        <label class="tp__label">
          价格 <span class="tp__hint">(USDT/{{ baseSymbol || "—" }})</span>
        </label>
        <div class="tp__inputWrap">
          <input
            v-model="limitPrice"
            class="tp__input"
            type="text"
            placeholder="例如：0.123456"
          />
          <div class="tp__unit">USDT</div>
        </div>
        <div class="tp__subhint">
          限价单：{{ side === "buy" ? "当市价 ≤ 你的价格时尝试成交" : "当市价 ≥ 你的价格时尝试成交" }}
        </div>
      </div>

      <!-- Amount row -->
      <div class="tp__row">
        <label class="tp__label">
          数量
          <span class="tp__hint">
            ({{ amountUnitLabel }})
          </span>
        </label>

        <div class="tp__inputWrap">
          <input v-model="amount" class="tp__input" type="text" placeholder="输入数量" />
          <div class="tp__unit">{{ amountUnit }}</div>
        </div>

        <div class="tp__subhint">
          {{ amountHelp }}
        </div>
      </div>

      <!-- Action -->
      <button class="tp__cta" :class="side" @click="submitOrder" :disabled="disabled || txBusy">
        {{ txBusy ? "提交中..." : (orderType === "limit" ? "提交限价单" : "提交市价单") }}
      </button>

      <div class="tp__fineprint">
        <div class="mono" style="margin-bottom: 6px;">{{ dexStatus }}</div>
        * 市价买：输入 USDT（maxQuoteIn）；市价卖：输入 {{ baseSymbol || "BASE" }}（amountBase）。<br />
        * 限价买/卖：价格按 1e18 缩放；数量按 base decimals（默认 18）解析。
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from "vue";
import { ethers } from "ethers";

/**
 * 组件入参：
 * - walletAddress: 用户钱包地址
 * - baseAddress: base 币地址（这里作为 DEX 接口参数 base）
 * - baseSymbol: base 符号
 */
const props = defineProps({
  walletAddress: { type: String, default: "" },
  baseAddress: { type: String, default: "" },
  baseSymbol: { type: String, default: "" },
});

const { walletAddress, baseAddress, baseSymbol } = props;

/* ====== DEX config ====== */
const DEX = "0x887D9Af1241a176107d31Bb3C69787DFff6dbaD8";

// base token address ✅ 来自父组件 props.baseAddress
const DOGE = computed(() => String(baseAddress || ""));

const DEX_ABI = [
  "function marketBuyFor(address base, uint256 maxQuoteIn)",
  "function marketSellFor(address base, uint256 amountBase)",
  "function limitBuyFor(address base, uint256 price, uint256 amountBase) returns (uint256 orderId)",
  "function limitSellFor(address base, uint256 price, uint256 amountBase) returns (uint256 orderId)",
];

/* ====== ui state ====== */
const orderType = ref("market"); // 'market' | 'limit'
const side = ref("buy"); // 'buy' | 'sell'

const amount = ref("");
const limitPrice = ref("");

/* ====== web3 state ====== */
const txBusy = ref(false);
const dexStatus = ref("ready");

const usdtDecimals = ref(18); // 如需精确，请接入 USDT.decimals()
const dogeDecimals = ref(18); // 如需精确，请接入 base ERC20.decimals()

let provider = null;
let signer = null;
let dex = null;

const disabled = computed(() => !walletAddress || !baseAddress);

/* ====== helpers ====== */
function short(addr) {
  const a = String(addr || "");
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function toScaledPrice(p) {
  return ethers.parseUnits(String(p), 18);
}
function toBaseAmount(v) {
  return ethers.parseUnits(String(v), dogeDecimals.value);
}
function toQuoteAmount(v) {
  return ethers.parseUnits(String(v), usdtDecimals.value);
}

async function ensureDex() {
  if (dex) return;
  if (!window.ethereum) throw new Error("MetaMask not found");

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  dex = new ethers.Contract(DEX, DEX_ABI, signer);
}

/* ====== trading (按你给的 sendTx/limit/market 接法实现) ====== */
async function sendTx(buildTx, label) {
  if (disabled.value) return;

  try {
    txBusy.value = true;
    dexStatus.value = `${label}: sending tx...`;
    await ensureDex();

    const tx = await buildTx();
    await tx.wait();

    dexStatus.value = `✅ ${label} confirmed.`;
  } catch (e) {
    dexStatus.value = `${label} error: ${e?.message || e}`;
  } finally {
    txBusy.value = false;
  }
}

function limitBuy() {
  return sendTx(
    () => dex.limitBuyFor(DOGE.value, toScaledPrice(limitPrice.value), toBaseAmount(amount.value)),
    "Limit Buy"
  );
}

function limitSell() {
  return sendTx(
    () => dex.limitSellFor(DOGE.value, toScaledPrice(limitPrice.value), toBaseAmount(amount.value)),
    "Limit Sell"
  );
}

function marketBuy() {
  console.log("amount.value: ", amount.value)
  console.log("DOGE.value: ", DOGE.value)
  return sendTx(
    () => dex.marketBuyFor(DOGE.value, toQuoteAmount(amount.value)),
    "Market Buy"
  );
}

function marketSell() {
  return sendTx(
    () => dex.marketSellFor(DOGE.value, toBaseAmount(amount.value)),
    "Market Sell"
  );
}

function submitOrder() {
  // 简单校验
  if (!amount.value || Number(amount.value) <= 0) {
    dexStatus.value = "请输入数量";
    return;
  }

  if (orderType.value === "limit") {
    if (!limitPrice.value || Number(limitPrice.value) <= 0) {
      dexStatus.value = "请输入限价价格";
      return;
    }
    return side.value === "buy" ? limitBuy() : limitSell();
  }

  return side.value === "buy" ? marketBuy() : marketSell();
}

/* ====== unit labels ====== */
const amountUnit = computed(() => {
  if (orderType.value === "market") return side.value === "buy" ? "USDT" : (baseSymbol || "BASE");
  return baseSymbol || "BASE";
});

const amountUnitLabel = computed(() => {
  if (orderType.value === "market") {
    return side.value === "buy" ? "市价买入用 USDT" : `市价卖出用 ${baseSymbol || "BASE"}`;
  }
  return `限价单数量用 ${baseSymbol || "BASE"}`;
});

const amountHelp = computed(() => {
  if (orderType.value === "market") {
    return side.value === "buy"
      ? "你输入最多花多少 USDT（maxQuoteIn），系统按市价撮合。"
      : `你输入要卖多少 ${baseSymbol || "BASE"}（amountBase），系统按市价撮合。`;
  }
  return `限价单：你输入 ${baseSymbol || "BASE"} 数量；价格输入 USDT/${baseSymbol || "BASE"}。`;
});

/* ====== reset dex instance when base changes (避免 base 切换时仍用旧状态) ====== */
watch(
  () => baseAddress,
  () => {
    // base 改变时不需要重建 provider/signer，但重新拉取/重新提交时会用 DOGE.value
    // dex 合约地址固定，因此不清 dex
  }
);

onUnmounted(() => {
  // no listeners here
});
</script>

<style lang="scss" scoped>
.tp {
  --bg: #0b0f14;
  --panel: rgba(255, 255, 255, 0.06);
  --panel2: rgba(255, 255, 255, 0.04);
  --line: rgba(255, 255, 255, 0.10);
  --text: rgba(255, 255, 255, 0.90);
  --muted: rgba(255, 255, 255, 0.55);

  --green: #00d084;
  --pink: #ff3b69;
  --cyan: #56c3ff;
  --glow: 0 0 18px rgba(0, 208, 132, 0.25);

  background: radial-gradient(1200px 700px at 20% 0%, rgba(0, 208, 132, 0.10), transparent 55%),
              radial-gradient(900px 600px at 90% 10%, rgba(255, 59, 105, 0.10), transparent 60%),
              var(--bg);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 16px;
  color: var(--text);
  max-width: 520px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.tp__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.tp__title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tp__badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.12em;
  background: linear-gradient(90deg, rgba(0, 208, 132, 0.22), rgba(86, 195, 255, 0.18));
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.92);
}

.tp__name {
  font-size: 16px;
  font-weight: 800;
}

.tp__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}

.tp__metaRow {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  background: var(--panel2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 8px 10px;
}

.tp__k {
  color: var(--muted);
  font-size: 12px;
}

.tp__v {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}

.tp__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.tp__tabs--secondary {
  grid-template-columns: 1fr 1fr;
  margin-bottom: 14px;
}

.tp__tab {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.70);
  font-weight: 800;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.tp__tab:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.92);
}

.tp__tab.active {
  background: linear-gradient(90deg, rgba(0, 208, 132, 0.22), rgba(86, 195, 255, 0.12));
  border-color: rgba(0, 208, 132, 0.40);
  box-shadow: var(--glow);
  color: rgba(255, 255, 255, 0.95);
}

.tp__tab--buy.active {
  background: linear-gradient(90deg, rgba(0, 208, 132, 0.30), rgba(0, 208, 132, 0.14));
  border-color: rgba(0, 208, 132, 0.45);
}

.tp__tab--sell.active {
  background: linear-gradient(90deg, rgba(255, 59, 105, 0.28), rgba(255, 59, 105, 0.10));
  border-color: rgba(255, 59, 105, 0.45);
  box-shadow: 0 0 18px rgba(255, 59, 105, 0.22);
}

.tp__card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 14px;
  padding: 14px;
}

.tp__cardHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.tp__pair {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.tp__pairBase {
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
}

.tp__pairSlash {
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
}

.tp__pairQuote {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
}

.tp__chip {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
}

.tp__chip.buy {
  border-color: rgba(0, 208, 132, 0.35);
  color: rgba(0, 208, 132, 0.95);
}

.tp__chip.sell {
  border-color: rgba(255, 59, 105, 0.35);
  color: rgba(255, 59, 105, 0.95);
}

.tp__row {
  margin-top: 12px;
}

.tp__label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  margin-bottom: 6px;
}

.tp__hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 600;
}

.tp__inputWrap {
  position: relative;
  display: flex;
  align-items: center;
}

.tp__input {
  width: 100%;
  padding: 12px 12px;
  padding-right: 64px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.92);
  outline: none;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.tp__input:focus {
  border-color: rgba(86, 195, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(86, 195, 255, 0.10);
}

.tp__unit {
  position: absolute;
  right: 10px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.55);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
}

.tp__subhint {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.50);
  line-height: 1.35;
}

.tp__cta {
  width: 100%;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-weight: 900;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.tp__cta.buy {
  background: linear-gradient(90deg, rgba(0, 208, 132, 0.85), rgba(86, 195, 255, 0.55));
  color: rgba(0, 0, 0, 0.90);
  box-shadow: 0 10px 30px rgba(0, 208, 132, 0.12);
}

.tp__cta.sell {
  background: linear-gradient(90deg, rgba(255, 59, 105, 0.80), rgba(255, 59, 105, 0.45));
  color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 30px rgba(255, 59, 105, 0.10);
}

.tp__cta:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.18);
}

.tp__fineprint {
  margin-top: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}
</style>
