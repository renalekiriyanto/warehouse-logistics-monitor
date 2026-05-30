<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: string;
}>();

const badgeClasses = computed(() => {
  const s = props.status?.toLowerCase().trim();
  
  switch (s) {
    case 'completed':
    case 'hadir':
    case 'berhasil':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending':
    case 'pagi':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'delayed':
    case 'alpa':
    case 'gagal':
    case 'sangat penting':
      return 'bg-rose-50 text-rose-700 border-rose-250 font-semibold';
    case 'priority':
    case 'penting':
    case 'malam':
      return 'bg-amber-50 text-amber-700 border-amber-250 font-medium';
    case 'siang':
    case 'izin':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
});

const labelText = computed(() => {
  const s = props.status || '';
  return s.charAt(0).toUpperCase() + s.slice(1);
});
</script>

<template>
  <span
    :id="'badge-' + status"
    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
    :class="badgeClasses"
  >
    <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-75"></span>
    {{ labelText }}
  </span>
</template>
