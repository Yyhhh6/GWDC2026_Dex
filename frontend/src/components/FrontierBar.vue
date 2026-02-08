<template>
	<header class="frontierbar">
		<div class="inner">
			<div class="left">
				<div class="brand">FrontierBar</div>
			</div>
			<div class="right">
				<slot />
			</div>
		</div>
	</header>
</template>

<script setup>
</script>

<style scoped>
.frontierbar {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	height: 56px;
	z-index: 50;
	background: white;
	border-bottom: 1px solid #ccc;
}

.inner {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 0 16px;
}

.brand {
	font-size: 14px;
	font-weight: 700;
}
</style>
