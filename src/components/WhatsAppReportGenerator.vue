<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { generateWhatsAppReport, getShiftForTime } from '../utils/whatsappGenerator';
import { Copy, Save, Check, Send, Sparkles, MessageCircleCode } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedShift = ref<'Pagi' | 'Siang' | 'Malam'>('Pagi');
const reportText = ref('');
const copied = ref(false);

// Initialize shift based on clock
onMounted(() => {
  const hr = new Date().getHours();
  selectedShift.value = getShiftForTime(hr);
  regenerate();
});

function regenerate() {
  reportText.value = generateWhatsAppReport(selectedShift.value);
}

// Recompile report draft if shift is updated
watch(selectedShift, () => {
  regenerate();
});

function handleCopy() {
  navigator.clipboard.writeText(reportText.value)
    .then(() => {
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2500);
    })
    .catch((err) => {
      console.error('Failed to copy', err);
    });
}

function handleOpenWhatsApp() {
  const enc = encodeURIComponent(reportText.value);
  window.open(`https://api.whatsapp.com/send?text=${enc}`, '_blank');
}
</script>

<template>
  <div id="wa-report-generator" class="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
    <!-- Header of WA Report Generator -->
    <div class="p-4 bg-green-600 text-white flex items-center justify-between">
      <div class="flex items-center gap-2">
        <MessageCircleCode class="w-5 h-5 text-white" />
        <span class="text-sm font-bold">WA Report Generator</span>
      </div>
      
      <!-- Quick Clipboard copy indicator button -->
      <button 
        id="btn-copy-wa-top"
        type="button"
        class="p-1.5 bg-green-700 hover:bg-green-800 rounded transition-colors text-white"
        title="Salin ke Clipboard"
        @click="handleCopy"
      >
        <component :is="copied ? Check : Copy" class="w-4 h-4" />
      </button>
    </div>

    <!-- Scrollable content preview -->
    <div class="p-4 bg-slate-50 border-b border-slate-200">
      <div class="relative">
        <textarea 
          id="wa-report-textarea"
          v-model="reportText"
          rows="12"
          class="w-full bg-white border border-slate-200 p-4 rounded text-[11px] font-mono whitespace-pre-wrap text-slate-650 leading-relaxed outline-hidden focus:ring-1 focus:ring-green-500 shadow-3xs"
          placeholder="Menjajaki statistik performa warehouse..."
        ></textarea>
      </div>
    </div>

    <!-- Actions and parameters footer -->
    <div class="p-4 bg-white space-y-3.5">
      <div class="flex justify-between items-center text-xs">
        <span class="text-slate-500 font-semibold tracking-wide">Shift Selection</span>
        <div class="flex gap-2">
          <button 
            v-for="shift in (['Pagi', 'Siang', 'Malam'] as const)"
            :key="shift"
            id="btn-shift-pill"
            type="button"
            class="px-2.5 py-1 text-2xs font-bold rounded-md border transition-all cursor-pointer"
            :class="selectedShift === shift 
              ? 'bg-slate-900 border-slate-900 text-white shadow-3xs' 
              : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-800'"
            @click="selectedShift = shift"
          >
            {{ shift }}
          </button>
        </div>
      </div>

      <!-- Action submission button -->
      <button 
        id="btn-send-whatsapp-trigger"
        type="button"
        class="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        @click="handleOpenWhatsApp"
      >
        <Send class="w-4 h-4" />
        {{ copied ? 'Disalin! Kirim ke WhatsApp' : 'Kirim via WhatsApp' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.text-2xs {
  font-size: 0.65rem;
}
.text-slate-650 {
  color: #475569;
}
</style>
