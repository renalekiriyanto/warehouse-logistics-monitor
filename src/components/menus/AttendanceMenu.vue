<script setup lang="ts">
import { ref } from 'vue';
import api from '../../utils/api';
import { useLogisticsStore } from '../../store/logisticsStore';
import { parseCSV } from '../../utils/csvParser';
import FileUpload from '../../components/FileUpload.vue';
import DataPreviewTable from '../../components/DataPreviewTable.vue';
import ValidationResult from '../../components/ValidationResult.vue';
import { TableProperties, Server, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-vue-next';

const store = useLogisticsStore();

// Integration API & Sync states
const apiLoading = ref(false);
const apiError = ref<string | null>(null);
const apiSuccess = ref(false);
const lastFetchTime = ref<string | null>(null);

async function fetchAttendanceApi() {
  apiLoading.value = true;
  apiError.value = null;
  apiSuccess.value = false;
  try {
    const response = await api.get('/attendances');
    const data = response.data;
    let rawItems: any[] = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data && Array.isArray(data.data)) {
      rawItems = data.data;
    } else if (data && typeof data === 'object') {
      rawItems = [data];
    } else {
      throw new Error('Format data tidak didukung (harus berupa Array)');
    }

    const mappedItems = rawItems.map((item: any) => ({
      courier: item.courier || item.kurir || 'Andi',
      date: item.date || item.tanggal || new Date().toISOString().substring(0, 10),
      shift: item.shift || 'Pagi',
      checkIn: item.checkIn || item.jam_masuk || '08:00',
      status: item.status || 'Hadir'
    }));

    store.importData('attendance', mappedItems);
    apiSuccess.value = true;
    lastFetchTime.value = new Date().toLocaleTimeString('id-ID');
  } catch (err: any) {
    console.error('Attendance API Fetch failed:', err);
    apiError.value = 'Koneksi ditolak oleh API FMS lokasl (Server Offline / CORS).';
  } finally {
    apiLoading.value = false;
  }
}

// CSV Parser Upload Handling
const rawParsedItems = ref<any[]>([]);
const validationErrors = ref<any[]>([]);
const totalParsedRows = ref(0);
const activeUploadedFileName = ref('');
const isAnalyzing = ref(false);

function onFileParsed(event: { text: string; fileName: string }) {
  discardDraft();
  isAnalyzing.value = true;
  activeUploadedFileName.value = event.fileName;

  setTimeout(() => {
    try {
      const result = parseCSV(event.text, 'attendance');
      rawParsedItems.value = result.items;
      validationErrors.value = result.errors;
      totalParsedRows.value = result.items.length;
    } catch (e: any) {
      validationErrors.value = [{
        row: 0,
        column: 'File Isu',
        message: 'Gagal mengurai file CSV: ' + e.message,
        value: ''
      }];
    } finally {
      isAnalyzing.value = false;
    }
  }, 400);
}

function onConfirmImport() {
  const cleanItems = rawParsedItems.value.filter((item) => !item._invalid);
  if (cleanItems.length === 0) {
    alert('Tidak ada baris data valid untuk diimpor.');
    return;
  }
  store.importData('attendance', cleanItems);
  discardDraft();
}

function discardDraft() {
  rawParsedItems.value = [];
  validationErrors.value = [];
  totalParsedRows.value = 0;
  activeUploadedFileName.value = '';
}

function onClearData() {
  if (confirm(`Apakah Anda yakin ingin menghapus seluruh data Absensi?`)) {
    store.clearData('attendance');
  }
}

// Columns definition for attendance WMS
const columns = [
  { key: 'courier', label: 'Nama Kurir', type: 'string' },
  { key: 'date', label: 'Tanggal', type: 'string' },
  { key: 'shift', label: 'Shift', type: 'string' },
  { key: 'checkIn', label: 'Jam Masuk', type: 'string' },
  { key: 'status', label: 'Status Kehadiran', type: 'string' }
];
</script>

<template>
  <div id="attendance-menu-comp" class="space-y-6">
    <!-- API Status section -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Server class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-slate-900 border-none">Integrasi FMS Presensi & Absensi (REST API)</h3>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border"
                :class="apiError ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'"
              >
                {{ apiError ? 'API Offline (Fallback Lokal)' : 'API Terhubung' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 max-w-lg leading-relaxed mt-1">
              Data absensi & shift harian logistik sinkron langsung ke server FMS:
              <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">GET /api/attendances</code>.
            </p>
          </div>
        </div>

        <button 
          id="btn-sync-attendance"
          type="button" 
          class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer disabled:opacity-50 select-none shrink-0"
          :disabled="apiLoading"
          @click="fetchAttendanceApi"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{'animate-spin': apiLoading}" />
          {{ apiLoading ? 'Menghubungkan...' : 'Sinkronkan Data FMS' }}
        </button>
      </div>

      <!-- Sync feedback States -->
      <div v-if="apiSuccess" class="p-3.5 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2.5">
        <CheckCircle2 class="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
        <div class="text-xs text-green-800 space-y-0.5 leading-relaxed">
          <p class="font-bold">Koneksi Berhasil!</p>
          <p>Membaca database presensi kurir aktif pada pukul <b>{{ lastFetchTime }}</b>.</p>
        </div>
      </div>

      <div v-if="apiError" class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-amber-900 space-y-1 leading-relaxed">
          <p class="font-bold">Gagal Terhubung ke http://127.0.0.1:8000/api/attendances</p>
          <p class="text-2xs text-slate-500">Koneksi lokal ditolak oleh API. Data absensi Anda disimpan secara aman melalui browser web cache, andal dalam penulisan laporan.</p>
        </div>
      </div>
    </div>

    <!-- File Upload Section -->
    <FileUpload 
      menu-key="attendance"
      menu-label="Import Data Absensi (CSV/Excel)"
      :has-data="store.attendance.length > 0"
      @file-parsed="onFileParsed"
      @clear-data="onClearData"
    />

    <!-- Verification Analysis -->
    <ValidationResult 
      v-if="totalParsedRows > 0"
      :errors="validationErrors"
      :total-rows="totalParsedRows"
      @confirm="onConfirmImport"
      @cancel="discardDraft"
    />

    <!-- Database Preview Table -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <TableProperties class="w-3.5 h-3.5" />
          Preview Database Absensi & Kehadiran (Total: {{ store.attendance.length }})
        </h3>
        <span class="text-2xs font-semibold text-slate-500 font-sans">Penyimpanan Terpasang: Lokal browser</span>
      </div>

      <DataPreviewTable 
        :items="store.attendance"
        :columns="columns"
      />
    </div>
  </div>
</template>
