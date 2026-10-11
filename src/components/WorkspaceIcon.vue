<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string> = {
  home: 'M3 10 12 3l9 7v10H3Z M9 20v-7h6v7',
  telemetry: 'M3 3v18h18 M6 15l4-6 4 4 5-8',
  data: 'm12 3 9 5v8l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v8',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  workspace: 'M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'm6 6 12 12 M18 6 6 18',
  arrow: 'M4 12h16 m-6-6 6 6-6 6',
  focus: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2'
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name] ?? paths.home" />
  </svg>
</template>
