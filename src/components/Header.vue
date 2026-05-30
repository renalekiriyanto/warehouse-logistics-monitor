<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useLogisticsStore } from '../store/logisticsStore';
import { Menu, RefreshCw, Clock, ShieldAlert, AlertCircle } from 'lucide-vue-next';

defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  (e: 'toggle-mobile'): void;
}>();

const store = useLogisticsStore();
const clockTime = ref('');

let clockIntervalId: any = null;

function updateClock() {
  const d = new Date();
  clockTime.value = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
}

onMounted(() => {
  updateClock();
  clockIntervalId = setInterval(updateClock, 1000);
});

onUnmounted(() => {
  if (clockIntervalId) clearInterval(clockIntervalId);
});

function handleReset() {
  if (confirm('Apakah Anda yakin ingin menyetel ulang seluruh data ke versi bawaan dasbor? Data yang Anda upload hari ini akan dibersihkan.')) {
    store.resetAllToDefault();
    alert('Seluruh data berhasil dikembalikan ke draf dummmy bawaan.');
  }
}
</script>

<template>
  <header id="header-bar" class="bg-white border-b border-slate-100 h-16 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-3xs">
    <!-- Toggle key + dynamic Title -->
    <div class="flex items-center gap-3">
      <button 
        id="btn-toggle-menu-mobile"
        type="button" 
        class="p-2 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg md:hidden cursor-pointer"
        @click="emit('toggle-mobile')"
      >
        <Menu class="w-5 h-5" />
      </button>

      <div>
        <h2 class="text-sm md:text-base font-bold text-slate-900 leading-tight tracking-tight">{{ title }}</h2>
        <div class="flex items-center gap-1.5 mt-0.5 text-3xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Struktur Portal</span>
          <span>•</span>
          <span class="text-blue-600 font-bold">Membaca Aktif (Read-Only monitoring)</span>
        </div>
      </div>
    </div>

    <!-- Active profiles / clock / reset shortcuts -->
    <div class="flex items-center gap-3 md:gap-4 text-xs font-semibold">
      <!-- Computer runtime clock -->
      <div class="hidden sm:flex items-center gap-1.5 text-slate-500 bg-slate-50 px-3 py-1.5 border border-slate-150 rounded-lg font-mono">
        <Clock class="w-3.5 h-3.5 text-slate-400" />
        <span class="text-slate-700 tabular-nums">{{ clockTime }}</span>
      </div>

      <!-- Quick Reset Database Shortcut -->
      <button 
        id="btn-quick-reset"
        type="button"
        class="inline-flex items-center gap-1 px-3 py-1.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition text-2xs cursor-pointer shadow-3xs"
        title="Reset database data bawaan"
        @click="handleReset"
      >
        <RefreshCw class="w-3.5 h-3.5 text-slate-400" />
        <span class="hidden md:inline">Reset Bawaan</span>
      </button>

      <!-- Profile indicator -->
      <div class="flex items-center gap-2 border-l border-slate-200 pl-3 md:pl-4">
        <div class="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs shadow-inner">
          OW
        </div>
        <div class="hidden lg:block text-left">
          <p class="font-bold text-slate-800 leading-none">Pak Budi</p>
          <span class="text-3xs font-semibold text-slate-400 uppercase tracking-widest mt-0.5 block">Supervisor</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.text-3xs {
  font-size: 0.6rem;
}
.text-2xs {
  font-size: 0.65rem;
}
</style>
