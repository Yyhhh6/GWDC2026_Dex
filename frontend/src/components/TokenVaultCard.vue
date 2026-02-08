<template>
	<section class="vault">
		<div class="header">
			<h2 class="title">Token Vault</h2>
			<div class="sub">Deposit / Withdraw to DEX</div>
		</div>

		<div class="card">
			<div class="row">
				<div class="label">Token</div>
				<div class="value">
					<span v-if="metaLoading">读取中…</span>
					<span v-else>{{ tokenName || "-" }}</span>
					<span class="sep">·</span>
					<span class="mono">{{ tokenSymbol || "-" }}</span>
				</div>
			</div>

			<div class="row">
				<div class="label">合约地址</div>
				<div class="value mono" :title="tokenAddress">{{ formatAddr(tokenAddress) }}</div>
			</div>

			<div class="row">
				<div class="label">钱包地址</div>
				<div class="value mono">
					<span v-if="!walletAddress">未连接</span>
					<span v-else>{{ formatAddr(walletAddress) }}</span>
				</div>
			</div>

			<div class="row">
				<div class="label">钱包余额</div>
				<div class="value mono">
					<span v-if="!walletAddress">-</span>
					<span v-else-if="balancesLoading">读取中…</span>
					<span v-else>{{ walletBalanceDisplay }}</span>
				</div>
			</div>

			<div class="row">
				<div class="label">DEX 已充值</div>
				<div class="value mono">
					<span v-if="!walletAddress">-</span>
					<span v-else-if="balancesLoading">读取中…</span>
					<span v-else>{{ dexBalanceDisplay }}</span>
				</div>
			</div>

			<div class="row">
				<div class="label">授权额度</div>
				<div class="value mono">
					<span v-if="!walletAddress">-</span>
					<span v-else-if="balancesLoading">读取中…</span>
					<span v-else>{{ allowanceDisplay }}</span>
				</div>
			</div>

			<div class="form">
				<label class="inputLabel">数量</label>
				<input
					v-model="amount"
					class="input"
					type="text"
					inputmode="decimal"
					placeholder="0.0"
				/>
				<div class="formHint">单位：{{ tokenSymbol || "token" }}</div>
			</div>

			<div class="actions">
				<button class="btn" type="button" :disabled="busy" @click="onDeposit">
					{{ busy ? "处理中…" : "充值到 DEX" }}
				</button>
				<button class="btn" type="button" :disabled="busy" @click="onWithdraw">
					{{ busy ? "处理中…" : "从 DEX 提取" }}
				</button>
			</div>

			<div class="links">
				<a class="link" :href="explorerUrl" target="_blank" rel="noreferrer">查看 Token 合约</a>
			</div>

			<div v-if="error" class="msg error">{{ error }}</div>
			<div v-else-if="status" class="msg">{{ status }}</div>
		</div>
	</section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Contract, JsonRpcProvider, formatUnits, isAddress, parseUnits } from "ethers";

import { PHAROS_ATLANTIC, PHAROS_ATLANTIC_EXPLORER_BASE, PHAROS_ATLANTIC_RPC_URL } from "../lib/pharos";
import { DEX_ADDRESS, callDex, ensurePharosChain, sendDex } from "../lib/dex";

const props = defineProps({
	tokenAddress: {
		type: String,
		required: true,
	},
});

const readProvider = new JsonRpcProvider(PHAROS_ATLANTIC_RPC_URL, PHAROS_ATLANTIC.chainId);

const walletAddress = ref("");
const metaLoading = ref(false);
const balancesLoading = ref(false);
const busy = ref(false);

const tokenName = ref("");
const tokenSymbol = ref("");
const tokenDecimals = ref(18);

const walletBalance = ref(0n);
const dexBalance = ref(0n);
const allowance = ref(0n);

const amount = ref("");
const error = ref("");
const status = ref("");

let ethForListeners;
let accountsHandler;
let chainHandler;

const ERC20_ABI = [
	"function name() view returns (string)",
	"function symbol() view returns (string)",
	"function decimals() view returns (uint8)",
	"function balanceOf(address) view returns (uint256)",
	"function allowance(address,address) view returns (uint256)",
	"function approve(address,uint256) returns (bool)",
];

const explorerUrl = computed(() => {
	const addr = String(props.tokenAddress || "").trim();
	return `${PHAROS_ATLANTIC_EXPLORER_BASE}/address/${addr}`;
});

const walletBalanceDisplay = computed(() => formatAmount(walletBalance.value));
const dexBalanceDisplay = computed(() => formatAmount(dexBalance.value));
const allowanceDisplay = computed(() => formatAmount(allowance.value));

function formatAddr(addr) {
	const a = String(addr || "");
	if (!a) return "-";
	if (a.length <= 12) return a;
	return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatAmount(raw) {
	try {
		const s = formatUnits(raw ?? 0n, tokenDecimals.value ?? 18);
		if (!s.includes(".")) return s;
		const [a, b] = s.split(".");
		return `${a}.${(b || "").slice(0, 6)}`.replace(/\.$/, "");
	} catch {
		return String(raw ?? "0");
	}
}

function getEthereum() {
	return typeof window !== "undefined" ? window.ethereum : undefined;
}

async function refreshWalletAddress() {
	const eth = getEthereum();
	if (!eth?.request) {
		walletAddress.value = "";
		return;
	}
	try {
		const accounts = await eth.request({ method: "eth_accounts" });
		walletAddress.value = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : "";
	} catch {
		walletAddress.value = "";
	}
}

function getReadTokenContract() {
	const addr = String(props.tokenAddress || "").trim();
	return new Contract(addr, ERC20_ABI, readProvider);
}

async function loadMeta() {
	error.value = "";
	status.value = "";

	const tokenAddr = String(props.tokenAddress || "").trim();
	if (!isAddress(tokenAddr)) {
		error.value = "tokenAddress 无效";
		return;
	}

	metaLoading.value = true;
	try {
		const token = getReadTokenContract();
		const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
		tokenName.value = String(name || "");
		tokenSymbol.value = String(symbol || "");
		tokenDecimals.value = Number(decimals);
	} catch (e) {
		error.value = e?.shortMessage || e?.message || "读取 token 元数据失败";
	} finally {
		metaLoading.value = false;
	}
}

async function refreshBalances() {
	const trader = String(walletAddress.value || "").trim();
	const tokenAddr = String(props.tokenAddress || "").trim();
	if (!trader || !isAddress(trader) || !isAddress(tokenAddr)) return;

	balancesLoading.value = true;
	try {
		const token = getReadTokenContract();
		const [wb, db, alw] = await Promise.all([
			token.balanceOf(trader),
			callDex("baseBalance", trader, tokenAddr),
			token.allowance(trader, DEX_ADDRESS),
		]);
		walletBalance.value = BigInt(wb);
		dexBalance.value = BigInt(db);
		allowance.value = BigInt(alw);
	} catch (e) {
		error.value = e?.shortMessage || e?.message || "读取余额失败";
	} finally {
		balancesLoading.value = false;
	}
}

function parseAmountOrThrow() {
	const s = String(amount.value || "").trim();
	if (!s) throw new Error("请输入数量");
	const v = parseUnits(s, tokenDecimals.value ?? 18);
	if (v <= 0n) throw new Error("数量必须大于 0");
	return v;
}

async function getWriteTokenContract() {
	const eth = getEthereum();
	if (!eth?.request) throw new Error("未检测到钱包扩展（window.ethereum）");
	await ensurePharosChain();
	await eth.request({ method: "eth_requestAccounts" });

	// 直接复用 BrowserProvider + signer（从 dex.js 里拿 ensurePharosChain 即可）
	const { BrowserProvider } = await import("ethers");
	const provider = new BrowserProvider(eth, "any");
	const signer = await provider.getSigner();
	return new Contract(String(props.tokenAddress || "").trim(), ERC20_ABI, signer);
}

async function ensureAllowance(required) {
	const trader = String(walletAddress.value || "").trim();
	if (!trader) {
		const eth = getEthereum();
		if (!eth?.request) throw new Error("未检测到钱包扩展（window.ethereum）");
		await eth.request({ method: "eth_requestAccounts" });
		await refreshWalletAddress();
	}

	await refreshBalances();
	if (allowance.value >= required) return;

	status.value = "正在授权…";
	const token = await getWriteTokenContract();
	const tx = await token.approve(DEX_ADDRESS, required);
	status.value = `授权已发送：${tx.hash}`;
	await tx.wait();
	status.value = "授权完成";
	await refreshBalances();
}

async function onDeposit() {
	error.value = "";
	status.value = "";
	busy.value = true;
	try {
		const tokenAddr = String(props.tokenAddress || "").trim();
		if (!isAddress(tokenAddr)) throw new Error("tokenAddress 无效");
		const v = parseAmountOrThrow();
		await ensureAllowance(v);

		status.value = "正在充值到 DEX…";
		const tx = await sendDex("depositBaseFor", tokenAddr, v);
		status.value = `充值已发送：${tx.hash}`;
		await tx.wait();
		status.value = "充值完成";
		await refreshBalances();
	} catch (e) {
		error.value = e?.shortMessage || e?.message || String(e);
	} finally {
		busy.value = false;
	}
}

async function onWithdraw() {
	error.value = "";
	status.value = "";
	busy.value = true;
	try {
		const tokenAddr = String(props.tokenAddress || "").trim();
		if (!isAddress(tokenAddr)) throw new Error("tokenAddress 无效");
		const v = parseAmountOrThrow();

		status.value = "正在从 DEX 提取…";
		const tx = await sendDex("withdrawBaseFor", tokenAddr, v);
		status.value = `提取已发送：${tx.hash}`;
		await tx.wait();
		status.value = "提取完成";
		await refreshBalances();
	} catch (e) {
		error.value = e?.shortMessage || e?.message || String(e);
	} finally {
		busy.value = false;
	}
}

onMounted(async () => {
	await loadMeta();
	await refreshWalletAddress();
	await refreshBalances();

	ethForListeners = getEthereum();
	if (ethForListeners?.on) {
		accountsHandler = accounts => {
			walletAddress.value = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : "";
			refreshBalances();
		};
		chainHandler = () => {
			refreshWalletAddress();
			refreshBalances();
		};
		ethForListeners.on("accountsChanged", accountsHandler);
		ethForListeners.on("chainChanged", chainHandler);
	}
});

onBeforeUnmount(() => {
	if (ethForListeners?.removeListener) {
		if (accountsHandler) ethForListeners.removeListener("accountsChanged", accountsHandler);
		if (chainHandler) ethForListeners.removeListener("chainChanged", chainHandler);
	}
});
</script>

<style scoped>
.vault {
	margin-top: 16px;
}

.header {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 12px;
	margin-bottom: 10px;
}

.title {
	margin: 0;
	font-size: 16px;
}

.sub {
	font-size: 12px;
	color: #666;
}

.card {
	border: 1px solid #ccc;
	border-radius: 12px;
	background: white;
	padding: 12px;
}

.row {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	padding: 6px 0;
}

.label {
	font-size: 12px;
	color: #666;
	font-weight: 600;
}

.value {
	font-size: 12px;
	text-align: right;
}

.mono {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
		monospace;
}

.sep {
	margin: 0 6px;
	color: #bbb;
}

.form {
	margin-top: 10px;
}

.inputLabel {
	display: block;
	font-size: 12px;
	color: #666;
	font-weight: 600;
	margin-bottom: 6px;
}

.input {
	width: 100%;
	height: 36px;
	padding: 0 10px;
	border: 1px solid #ccc;
	border-radius: 10px;
	font-size: 13px;
}

.formHint {
	margin-top: 6px;
	font-size: 12px;
	color: #666;
}

.actions {
	display: grid;
	grid-template-columns: 1fr;
	gap: 8px;
	margin-top: 10px;
}

.btn {
	height: 34px;
	padding: 0 10px;
	border: 1px solid #ccc;
	border-radius: 10px;
	background: white;
	cursor: pointer;
	font-size: 13px;
	font-weight: 600;
	text-align: left;
	color: inherit;
}

.btn:hover {
	border-color: #999;
}

.btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.links {
	margin-top: 10px;
}

.link {
	font-size: 12px;
	color: inherit;
	text-decoration: none;
	border-bottom: 1px dashed #bbb;
}

.msg {
	margin-top: 10px;
	font-size: 12px;
	color: #666;
	word-break: break-all;
}

.msg.error {
	color: #b42318;
}
</style>
