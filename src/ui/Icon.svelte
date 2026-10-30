<!-- Minimal line icons (24×24, stroke = currentColor), drawn like spotlog's -->
<svg class="icon" width={ size } height={ size } viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if name === 'boat'}
        <path d="M12 3.5v12" />
        <path d="M12 4.5l6 10h-6" />
        <path d="M10 6.5l-5 8h5" />
        <path d="M3.5 17.5h17l-2.2 3h-12.6z" />
    {:else if name === 'route'}
        <circle cx="5.5" cy="6" r="2" />
        <path d="M7.5 6h7a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 0 0 7h7" />
        <path d="M18.5 17.5l2 2.5-2 2.5" />
    {:else if name === 'weather'}
        <path d="M8 4.5v1.2M3.9 8.6h-1.2M5.1 5.6l.8.8M10.9 5.6l-.8.8" />
        <path d="M5.4 11.2A3 3 0 0 1 10.9 9" />
        <path d="M8.5 19.5h8.2a3.3 3.3 0 0 0 .3-6.6 4.6 4.6 0 0 0-8.9 1.3 2.7 2.7 0 0 0 .4 5.3z" />
    {:else if name === 'map'}
        <path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" />
        <path d="M9 4.5v13M15 6.5v13" />
    {:else if name === 'person'}
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20.5a7 7 0 0 1 14 0" />
    {:else if name === 'flag'}
        <path d="M5.5 21V4" />
        <path d="M5.5 4.5h11l-2.5 3.5 2.5 3.5h-11" />
    {/if}
</svg>

<script lang="ts">
    export let name: 'boat' | 'route' | 'weather' | 'map' | 'flag' | 'person';
    export let size = 20;
</script>

<style>
    .icon { display: block; flex-shrink: 0; }
</style>
