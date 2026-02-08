<template>
	<section class="tokenView">
		<div class="head">
			<button class="back" type="button" @click="goBack">返回</button>
			<div class="info">
				<div class="title">Token</div>
				<div class="addr mono" :title="address">{{ address }}</div>
			</div>
		</div>

		<DexAssetsCard />

		<TokenVaultCard :tokenAddress="address" />
	</section>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import DexAssetsCard from "../components/DexAssetsCard.vue";
import TokenVaultCard from "../components/TokenVaultCard.vue";

const props = defineProps({
	address: {
		type: String,
		required: false,
		default: "",
	},
});

const route = useRoute();
const router = useRouter();

const address = computed(() => String(props.address || route.params.address || "").trim());

function goBack() {
	if (window.history.length > 1) router.back();
	else router.push({ name: "home" });
}
</script>

<style scoped>
.tokenView {
	max-width: 980px;
}

.head {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 12px;
}

.back {
	height: 34px;
	padding: 0 12px;
	border-radius: 10px;
	border: 1px solid #ccc;
	background: white;
	cursor: pointer;
	font-weight: 600;
}

.back:hover {
	border-color: #999;
}

.info {
	min-width: 0;
}

.title {
	font-size: 14px;
	font-weight: 700;
}

.addr {
	margin-top: 2px;
	font-size: 12px;
	color: #666;
	word-break: break-all;
}

.mono {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
		monospace;
}
</style>
