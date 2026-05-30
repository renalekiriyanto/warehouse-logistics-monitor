<script setup lang="ts">
import { computed } from 'vue';
import { ValidationError } from '../types';
import { AlertCircle, CheckCircle2, ShieldAlert, Ban } from 'lucide-vue-next';

const props = defineProps<{
  errors: ValidationError[];
  totalRows: number;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const errorCount = computed(() => props.errors.length);
const validCount = computed(() => Math.max(0, props.totalRows - errorCount.value));

const hasBlocks = computed(() => errorCount.value > 0);
const allFailed = computed(() => errorCount.value > 0 && validCount.value === 0);
</script>

<template>
  <div id="validation-result-panel" class="bg-slate-50 rounded-xl p-5 border border-slate-200/80 mb-6 animate-fade-in">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-slate-800 flex items-center gap-2">
        <ShieldAlert class="w-4 h-4 text-blue-600" />
        Analisis Struktur & Validasi Data
      </h3>
      <span class="text-xs text-slate-500">Total Baris Terbaca: <b class="text-slate-800 font-bold">{{ totalRows }}</b></span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <!-- Success panel -->
      <div class="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3.5 flex items-start gap-3">
        <CheckCircle2 class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h4 class="text-xs font-semibold text-emerald-800">Baris Valid (Siap Impor)</h4>
          <p class="text-lg font-bold text-emerald-900 mt-1">{{ validCount }} <span class="text-xs font-normal text-emerald-600">dari {{ totalRows }} total baris</span></p>
          <p class="text-2xs text-emerald-600 mt-0.5">Baris-baris ini telah lulus validasi tipe data dan skema unik.</p>
        </div>
      </div>

      <!-- Errors panel -->
      <div 
        class="border rounded-lg p-3.5 flex items-start gap-3 transition-colors"
        :class="hasBlocks ? 'bg-rose-50/50 border-rose-100 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-500'"
      >
        <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" :class="hasBlocks ? 'text-rose-600' : 'text-slate-400'" />
        <div>
          <h4 class="text-xs font-semibold" :class="hasBlocks ? 'text-rose-800' : 'text-slate-700'">Baris Error (Ditolak)</h4>
          <p class="text-lg font-bold mt-1" :class="hasBlocks ? 'text-rose-900' : 'text-slate-800'">{{ errorCount }}</p>
          <p class="text-2xs mt-0.5" :class="hasBlocks ? 'text-rose-600' : 'text-slate-400'">
            {{ hasBlocks ? 'Baris ini berisi data yang rusak, duplikat, atau format kolom yang salah.' : 'Seluruh data bersih. Siap untuk proses pemantauan.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Error listings if any -->
    <div v-if="hasBlocks" class="mb-5 bg-white rounded-lg border border-rose-100 max-h-52 overflow-y-auto p-3 shadow-inner">
      <div class="text-xs font-semibold text-rose-800 mb-2 border-b border-rose-50 pb-1 flex items-center justify-between sticky top-0 bg-white">
        <span>Detail Kesalahan Pengisian File ({{ errorCount }} Isu):</span>
        <Ban class="w-3 h-3 text-rose-500" />
      </div>
      <table class="w-full text-left border-collapse text-2xs">
        <thead>
          <tr class="text-slate-500 uppercase border-b border-slate-100">
            <th class="py-1 px-2 font-semibold">Baris</th>
            <th class="py-1 px-2 font-semibold">Kolom</th>
            <th class="py-1 px-2 font-semibold">Deskripsi Isu Kesalahan</th>
            <th class="py-1 px-2 font-semibold text-right">Nilai Diterima</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50 font-mono">
          <tr v-for="(err, idx) in errors" :key="idx" class="hover:bg-rose-50/20 text-slate-700">
            <td class="py-1 px-2 font-bold text-rose-600 bg-rose-50/30 text-center w-10">#{{ err.row }}</td>
            <td class="py-1 px-2 font-semibold text-slate-800">{{ err.column }}</td>
            <td class="py-1 px-2 text-rose-750 line-clamp-1 truncate max-w-xs">{{ err.message }}</td>
            <td class="py-1 px-2 text-right text-slate-500">{{ err.value === '' ? '(kosong)' : err.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- User advice guidelines callout -->
    <div v-if="hasBlocks" class="text-2xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5 mb-4 flex items-start gap-1.5 leading-relaxed">
      <span class="font-bold">💡 Sifat Unggahan:</span>
      <span>
        Sistem mendeteksi sel-sel yang rusak. Jika Anda menekan <b>"Konfirmasi Impor"</b>, baris yang salah akan <b>dilewatkan demi keamanan operasional</b>, dan hanya data yang valid yang akan disinkronkan ke dasbor. Disarankan membatalkan, memperbaiki kolom merah di CSV milik Anda, lalu unggah ulang.
      </span>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200/60 pt-4">
      <button 
        id="btn-cancel-import"
        type="button" 
        class="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-250 rounded-lg shadow-2xs hover:bg-slate-50 hover:text-slate-750 transition"
        @click="emit('cancel')"
      >
        Batalkan & Perbaiki File
      </button>
      <button 
        id="btn-confirm-import"
        type="button" 
        class="px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-2xs transition"
        :class="allFailed ? 'bg-slate-350 cursor-not-allowed' : 'bg-slate-900 border border-slate-955 hover:bg-slate-800'"
        :disabled="allFailed"
        @click="emit('confirm')"
      >
        {{ allFailed ? 'Unggah Ulang File Valid' : 'Konfirmasi Impor Data Valid' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.text-2xs {
  font-size: 0.65rem;
}
.text-rose-750 {
  color: #b91c1c;
}
</style>
