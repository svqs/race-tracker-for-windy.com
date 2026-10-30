<!-- A plain wind arrow (a line with an arrowhead). Like Windy's, it points where the wind blows to;
     `from` is the direction the wind comes from, in degrees (0 = north). -->
<svg class="wa" width={ size } height={ size } viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate({ (from ?? 0) + 180 }deg)">
    <path d="M12 20.5 V4.5 M5.5 11 L12 4.5 L18.5 11" fill="none" stroke="currentColor" stroke-width={ weight } stroke-linecap="round" stroke-linejoin="round" />
</svg>

<script lang="ts">
    export let from: number | null = 0;
    export let size: number | string = 16;
    export let weight = 2.6;
</script>

<style>
    .wa { display: inline-block; flex-shrink: 0; vertical-align: middle; }
</style>
