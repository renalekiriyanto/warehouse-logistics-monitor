<script setup lang="ts">
import { ref } from 'vue';
import { UploadCloud, FileSpreadsheet, Download, RefreshCw, AlertCircle } from 'lucide-vue-next';
import * as XLSX from 'xlsx';
import { MenuKey } from '../types';
import { generateCSVSample } from '../utils/csvParser';

const props = defineProps<{
  menuKey: MenuKey;
  menuLabel: string;
  hasData: boolean;
}>();

const emit = defineEmits<{
  (e: 'file-parsed', result: { text: string; fileName: string }): void;
  (e: 'clear-data'): void;
}>();

const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadError = ref<string | null>(null);
const processing = ref(false);
const activeFileName = ref<string | null>(null);

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  uploadError.value = null;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    processFile(files[0]);
  }
}

function triggerSelectFile() {
  fileInput.value?.click();
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    processFile(files[0]);
  }
}

function processFile(file: File) {
  uploadError.value = null;
  const suffix = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  // Validate suffix (allow both CSV and Excel)
  if (suffix !== '.csv' && suffix !== '.txt' && suffix !== '.xlsx' && suffix !== '.xls') {
    uploadError.value = 'Hanya menerima file format CSV (.csv, .txt) atau Excel (.xlsx, .xls) saja.';
    return;
  }

  processing.value = true;
  activeFileName.value = file.name;

  if (suffix === '.xlsx' || suffix === '.xls') {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        emit('file-parsed', { text: csvText, fileName: file.name });
      } catch (err: any) {
        uploadError.value = 'Gagal memproses berkas Excel: ' + err.message;
      } finally {
        processing.value = false;
      }
    };
    reader.onerror = () => {
      uploadError.value = 'Gagal membaca isi konten file Excel.';
      processing.value = false;
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      emit('file-parsed', { text, fileName: file.name });
      processing.value = false;
    };
    reader.onerror = () => {
      uploadError.value = 'Gagal membaca isi konten file.';
      processing.value = false;
    };
    reader.readAsText(file);
  }
}

function triggerDownloadTemplate() {
  const csvContent = generateCSVSample(props.menuKey);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `template_sample_${props.menuKey}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
</script>

<template>
  <div :id="'uploader-' + menuKey" class="bg-white border border-slate-100 rounded-xl p-6 shadow-2xs mb-6">
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2 text-sm">
      <div>
        <h3 class="font-semibold text-slate-800 flex items-center gap-1.5 leading-none">
          <FileSpreadsheet class="w-4 h-4 text-emerald-600" />
          Metode Sinkronisasi Upload CSV & Excel
        </h3>
        <p class="text-xs text-slate-500 mt-1">Unggah daftar terbaru untuk memantau status operasional secara berkala.</p>
      </div>

      <div class="flex items-center gap-2">
        <button 
          id="btn-download-sample"
          type="button"
          class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-lg transition"
          @click="triggerDownloadTemplate"
        >
          <Download class="w-3.5 h-3.5 text-slate-500" />
          Download Template .CSV
        </button>
        
        <button 
          v-if="hasData"
          id="btn-reset-data"
          type="button"
          class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition"
          @click="emit('clear-data')"
        >
          <RefreshCw class="w-3.5 h-3.5 text-rose-500" />
          Reset / Kosongkan Data
        </button>
      </div>
    </div>

    <!-- Drag area -->
    <div 
      id="drag-drop-container"
      class="border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all cursor-pointer"
      :class="isDragging 
        ? 'border-blue-500 bg-blue-50/40 shadow-inner' 
        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/50'"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="triggerSelectFile"
    >
      <input 
        ref="fileInput"
        type="file" 
        class="hidden" 
        accept=".csv,.txt,.xlsx,.xls"
        @change="handleFileSelect"
      />

      <div class="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-500">
        <UploadCloud class="w-6 h-6 text-slate-400 animate-pulse" />
      </div>

      <div v-if="processing" class="space-y-1.5">
        <p class="text-sm font-semibold text-blue-600 flex items-center gap-2 justify-center">
          <RefreshCw class="w-4 h-4 animate-spin" />
          Memproses File...
        </p>
        <p class="text-xs text-slate-400">Membaca data baris {{ activeFileName }}</p>
      </div>
      
      <div v-else class="space-y-1">
        <p class="text-sm font-semibold text-slate-700"> Drag & drop berkas CSV / Excel atau <span class="text-blue-600 hover:underline">pilih file explorer</span></p>
        <p class="text-xs text-slate-500">Menerima format CSV (.csv, .txt) atau Excel (.xlsx, .xls)</p>
      </div>
    </div>

    <!-- Error Alert inside FileUploader -->
    <div 
      v-if="uploadError"
      id="upload-error-banner"
      class="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-150 flex items-start gap-2.5 text-xs text-rose-700 leading-relaxed active"
    >
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
      <div>
        <span class="font-bold">Gagal Mengimpor:</span> {{ uploadError }}
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
