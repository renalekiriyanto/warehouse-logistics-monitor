<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api';
import { useLogisticsStore } from '../../store/logisticsStore';
import { ProjectionData } from '../../types';
import { parseCSV } from '../../utils/csvParser';
import FileUpload from '../../components/FileUpload.vue';
import DataPreviewTable from '../../components/DataPreviewTable.vue';
import ValidationResult from '../../components/ValidationResult.vue';
import { 
  CalendarDays, Server, RefreshCw, CheckCircle2, AlertCircle, 
  UploadCloud, TableProperties, AlertTriangle, FileText, Loader2 
} from 'lucide-vue-next';

const store = useLogisticsStore();

// API Loading and status variables
const apiLoading = ref(false);
const apiError = ref<string | null>(null);
const apiSuccess = ref(false);
const isUploading = ref(false);
const lastFetchTime = ref<string | null>(null);

// Manual notification state
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
  notification.value = { message, type };
  setTimeout(() => {
    notification.value = null;
  }, 4000);
}

// Fetch projections from active REST API
async function fetchProjectionsApi() {
  apiLoading.value = true;
  apiError.value = null;
  apiSuccess.value = false;
  try {
    const response = await api.get('/projections');

    const data = response.data;
    let rawItems: any[] = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data && Array.isArray(data.projections)) {
      rawItems = data.projections;
    } else if (data && Array.isArray(data.data)) {
      rawItems = data.data;
    } else if (data && typeof data === 'object') {
      rawItems = [data];
    } else {
      throw new Error('Suku format data JSON tidak dikenali');
    }

    // Map fetched properties safely matching ProjectionData schema
    const mappedData: ProjectionData[] = rawItems.map((item: any) => ({
      date_inbound: item.date_inbound || new Date().toISOString().substring(0, 10),
      projected_inbound: Number(item.projected_inbound) || 0
    }));

    // Update logistics store
    store.importData('projection', mappedData);
    
    apiSuccess.value = true;
    lastFetchTime.value = new Date().toLocaleTimeString('id-ID');
    showNotification(`Berhasil mengambil ${mappedData.length} data proyeksi dari API.`, 'success');
  } catch (err: any) {
    console.error('Projections API Fetch failed:', err);
    apiError.value = err.response?.data?.message || err.message || 'REST API di port 8000 tidak merespons.';
    showNotification('Gagal terhubung ke API Proyeksi. Menggunakan database lokal.', 'info');
  } finally {
    apiLoading.value = false;
  }
}

// Client-side CSV file selected
const clientFile = ref<File | null>(null);
const clientFileName = ref('');
const rawParsedItems = ref<any[]>([]);
const validationErrors = ref<any[]>([]);
const totalParsedRows = ref(0);
const isAnalyzing = ref(false);

function onFileSelected(event: { text: string; fileName: string; file?: File }) {
  discardDraft();
  isAnalyzing.value = true;
  clientFileName.value = event.fileName;
  if (event.file) {
    clientFile.value = event.file;
  }

  // Parse Client-Side for manual validation
  setTimeout(() => {
    try {
      const result = parseCSV(event.text, 'projection');
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

// Process and Upload CSV to the Projection Upload API
async function onConfirmImport() {
  const cleanItems = rawParsedItems.value.filter((item) => !item._invalid);
  
  if (cleanItems.length === 0) {
    showNotification('Tidak ada baris data valid untuk diimpor.', 'error');
    return;
  }

  isUploading.value = true;

  try {
    // If we have a real File instance, upload it as multipart/form-data to POST /api/projections/upload
    if (clientFile.value) {
      const formData = new FormData();
      formData.append('file', clientFile.value);

      await api.post('/projections/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showNotification('Berkas CSV berhasil di-upload secara binary ke REST API!', 'success');
      // Refresh GET
      await fetchProjectionsApi();
    } else {
      // Re-create a mock CSV string and upload if File object is absent
      const csvHeaders = 'Tanggal Proyeksi,Ekspektasi Volum,Kategori Cargo,Asal Shipment,PIC Logistik,Status\n';
      const csvRows = cleanItems.map(item => 
        `"${item.date}",${item.volume},"${item.category}","${item.origin}","${item.pic}","${item.status}"`
      ).join('\n');
      
      const csvBlob = new Blob([csvHeaders + csvRows], { type: 'text/csv' });
      const apiFile = new File([csvBlob], 'projection_batch.csv', { type: 'text/csv' });
      
      const formData = new FormData();
      formData.append('file', apiFile);

      await api.post('/projections/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showNotification('Upload proyeksi sukses!', 'success');
      await fetchProjectionsApi();
    }
  } catch (err: any) {
    console.warn('POST target upload gagal, fallback ke penyimpanan lokal browser:', err.message);
    
    // Local fallback
    store.importData('projection', cleanItems);
    showNotification('API Offline. Data proyeksi tersimpan secara antarmuka lokal.', 'info');
  } finally {
    isUploading.value = false;
    discardDraft();
  }
}

function discardDraft() {
  rawParsedItems.value = [];
  validationErrors.value = [];
  totalParsedRows.value = 0;
  clientFileName.value = '';
  clientFile.value = null;
}

function onClearData() {
  if (confirm(`Apakah Anda yakin ingin menghapus seluruh data Proyeksi?`)) {
    store.clearData('projection');
    showNotification('Data proyeksi dibersihkan.', 'info');
  }
}

const filterStartDate = ref('');
const filterEndDate = ref('');

const filteredProjections = computed(() => {
  let list = store.projection;
  if (filterStartDate.value) {
    list = list.filter(item => item.date >= filterStartDate.value);
  }
  if (filterEndDate.value) {
    list = list.filter(item => item.date <= filterEndDate.value);
  }
  return list;
});

function clearDateFilter() {
  filterStartDate.value = '';
  filterEndDate.value = '';
}

const columns = [
  { key: 'date_inbound', label: 'Tanggal Proyeksi', type: 'string' },
  { key: 'projected_inbound', label: 'Ekspektasi Volum', type: 'number' }
];

onMounted(() => {
  fetchProjectionsApi();
});
</script>

<template>
  <div id="projection-menu-comp" class="space-y-6">
    <!-- Floating Notification -->
    <div 
      v-if="notification" 
      class="fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-lg border text-xs max-w-sm flex items-center gap-2.5 animate-fade-in transition-all"
      :class="{
        'bg-green-50 border-green-200 text-green-800': notification.type === 'success',
        'bg-amber-50 border-amber-200 text-amber-800': notification.type === 'info',
        'bg-red-50 border-red-200 text-red-800': notification.type === 'error'
      }"
    >
      <CheckCircle2 v-if="notification.type === 'success'" class="w-4 h-4 text-green-600 shrink-0" />
      <AlertTriangle v-else class="w-4 h-4 text-amber-600 shrink-0" />
      <span>{{ notification.message }}</span>
    </div>

    <!-- API Status section -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Server class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-slate-900 border-none">API Proyeksi FMS (Forecasting)</h3>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border"
                :class="apiError ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'"
              >
                {{ apiError ? 'API Offline (Fallback Lokal)' : 'API Terhubung' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 max-w-lg leading-relaxed mt-1">
              Data ditarik dari <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">GET /api/projections</code> 
              dan file diunggah ke <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">POST /api/projections/upload</code>.
            </p>
          </div>
        </div>

        <button 
          id="btn-sync-projection"
          type="button" 
          class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer disabled:opacity-50 select-none shrink-0"
          :disabled="apiLoading"
          @click="fetchProjectionsApi"
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
          <p>Membaca data proyeksi logistik aktif pada pukul <b>{{ lastFetchTime }}</b>.</p>
        </div>
      </div>

      <div v-if="apiError" class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-amber-900 space-y-1 leading-relaxed">
          <p class="font-bold">Gagal Terhubung ke http://127.0.0.1:8000/api/projections</p>
          <p class="text-2xs text-slate-500">Pastikan REST API lokal Anda berjalan di port 8000. Sistem menggunakan data lokal browser agar Anda tetap dapat mengeksplorasi chart & draf.</p>
        </div>
      </div>
    </div>

    <!-- File Upload Section -->
    <FileUpload 
      menu-key="projection"
      menu-label="Upload Proyeksi Pengiriman"
      :has-data="store.projection.length > 0"
      @file-parsed="onFileSelected"
      @clear-data="onClearData"
    />

    <!-- Verification Analysis -->
    <ValidationResult 
      v-if="totalParsedRows > 0"
      :errors="validationErrors"
      :total-rows="totalParsedRows"
      @confirm="onConfirmImport"
      @cancel="discardDraft"
    >
      <template #confirm-text>
        <span class="flex items-center gap-1">
          <Loader2 v-if="isUploading" class="w-3.5 h-3.5 animate-spin" />
          <UploadCloud v-else class="w-3.5 h-3.5" />
          {{ isUploading ? 'Mengunggah Berkas...' : 'Kirim Berkas ke Server API' }}
        </span>
      </template>
    </ValidationResult>

    <!-- Date Filter Section -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex items-center gap-2">
        <CalendarDays class="w-4 h-4 text-blue-600" />
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Filter Tanggal Proyeksi</h4>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 items-end gap-3.5">
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mulai Tanggal</label>
          <input 
            v-model="filterStartDate"
            type="date" 
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sampai Tanggal</label>
          <input 
            v-model="filterEndDate"
            type="date" 
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
        <button 
          id="btn-clear-projection-date"
          type="button"
          class="flex items-center justify-center gap-1.5 px-4 py-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 cursor-pointer h-9 transition-colors select-none"
          @click="clearDateFilter"
        >
          Reset Filter
        </button>
      </div>
    </div>

    <!-- Database Preview Table -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <TableProperties class="w-3.5 h-3.5" />
          Preview Database Proyeksi (Total: {{ filteredProjections.length }})
        </h3>
        <span class="text-2xs font-semibold text-slate-500 font-sans">Terakhir Disinkron: REST API & Storage</span>
      </div>

      <DataPreviewTable 
        :items="filteredProjections"
        :columns="columns"
      />
    </div>
  </div>
</template>

<style scoped>
.text-3xs {
  font-size: 0.58rem;
}
.text-2xs {
  font-size: 0.65rem;
}
</style>
