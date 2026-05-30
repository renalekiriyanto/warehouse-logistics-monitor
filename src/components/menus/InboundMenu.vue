<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api';
import { useLogisticsStore } from '../../store/logisticsStore';
import { InboundData } from '../../types';
import { parseCSV } from '../../utils/csvParser';
import FileUpload from '../../components/FileUpload.vue';
import DataPreviewTable from '../../components/DataPreviewTable.vue';
import ValidationResult from '../../components/ValidationResult.vue';
import { 
  Inbox, ListPlus, Server, RefreshCw, CheckCircle2, AlertCircle, 
  Send, TableProperties, AlertTriangle, HelpCircle, Check, Loader2, Trash2 
} from 'lucide-vue-next';

const store = useLogisticsStore();

// API and Sync States
const apiLoading = ref(false);
const apiError = ref<string | null>(null);
const apiSuccess = ref(false);
const isCreating = ref(false);
const lastFetchTime = ref<string | null>(null);

// Manual Input Form States
const showForm = ref(false);
const formResi = ref('');
const formSender = ref('');
const formReceiver = ref('');
const formDestination = ref('');
const formWeight = ref<number | null>(null);
const formCourier = ref('');
const formStatus = ref<'pending' | 'completed' | 'delayed'>('pending');

// Notification State
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
  notification.value = { message, type };
  setTimeout(() => {
    notification.value = null;
  }, 4000);
}

// Fetch inbounds from external API
async function fetchInboundApi() {
  apiLoading.value = true;
  apiError.value = null;
  apiSuccess.value = false;
  try {
    const response = await api.get('/cutoff-inbounds');

    const data = response.data;
    let rawItems: any[] = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data && Array.isArray(data.data)) {
      rawItems = data.data;
    } else if (data && typeof data === 'object') {
      rawItems = [data];
    } else {
      throw new Error('Suku format data JSON tidak didukung (harus berupa Array)');
    }

    // Map fetched properties safely matching InboundData schema
    const mappedData: InboundData[] = rawItems.map((item: any) => ({
      resi: item.resi || item.no_resi || `RESI-${Math.floor(100000 + Math.random() * 900000)}`,
      sender: item.sender || item.pengirim || 'Unknown Sender',
      receiver: item.receiver || item.penerima || 'Unknown Receiver',
      destination: item.destination || item.kota_tujuan || 'Unspecified',
      weight: Number(item.weight) || Number(item.berat) || 1.0,
      courier: item.courier || item.kurir || 'Staff',
      status: ['pending', 'completed', 'delayed'].includes(item.status?.toLowerCase()) 
        ? item.status.toLowerCase() as 'pending' | 'completed' | 'delayed'
        : 'pending'
    }));

    // Save into Pinia Store
    store.importData('inbound', mappedData);
    
    apiSuccess.value = true;
    lastFetchTime.value = new Date().toLocaleTimeString('id-ID');
    showNotification(`Berhasil menyinkronkan ${mappedData.length} data Inbound dari API.`, 'success');
  } catch (err: any) {
    console.error('Inbound API Fetch failed:', err);
    apiError.value = err.response?.data?.message || err.message || 'Koneksi ditolak oleh API lokal (CORS / Server Offline).';
    showNotification('Gagal terhubung ke API Inbound. Menggunakan database lokal.', 'info');
  } finally {
    apiLoading.value = false;
  }
}

// Create new inbound entry via API (with manual fallback)
async function submitInbound() {
  if (!formResi.value || !formSender.value || !formReceiver.value || !formDestination.value || !formWeight.value || !formCourier.value) {
    showNotification('Harap lengkapi semua field formulir!', 'error');
    return;
  }

  isCreating.value = true;
  const payload = {
    resi: formResi.value.trim(),
    sender: formSender.value.trim(),
    receiver: formReceiver.value.trim(),
    destination: formDestination.value.trim(),
    weight: Number(formWeight.value),
    courier: formCourier.value.trim(),
    status: formStatus.value
  };

  try {
    // Attempt POST request
    await api.post('/cutoff-inbounds', payload);

    showNotification('Berhasil menyimpan data baru ke server API!', 'success');
    
    // Refresh table by hitting GET again
    await fetchInboundApi();
    
    // Reset forms
    resetForm();
  } catch (err: any) {
    console.warn('POST ke API gagal, fallback ke penyimpanan lokal:', err.message);
    
    // Local Store fallback
    const localItems = [...store.inbound];
    // Check if duplicate resi exists locally
    if (localItems.some(item => item.resi === payload.resi)) {
      showNotification(`Duplikasi Resi lokal! No Resi '${payload.resi}' sudah ada dalam database.`, 'error');
      isCreating.value = false;
      return;
    }

    localItems.unshift(payload);
    store.importData('inbound', localItems);
    showNotification('API Offline. Data tersimpan di database lokal browser.', 'info');
    resetForm();
  } finally {
    isCreating.value = false;
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
      const result = parseCSV(event.text, 'inbound');
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

// Bulk POST uploaded items to API if active, otherwise fallback to importData
async function onConfirmImport() {
  const cleanItems = rawParsedItems.value.filter((item) => !item._invalid);
  
  if (cleanItems.length === 0) {
    showNotification('Tidak ada baris data valid untuk diimpor. Periksa kembali file CSV.', 'error');
    return;
  }

  apiLoading.value = true;
  let uploadCount = 0;
  let apiFailed = false;

  // Let's try to post these to the API, if API fails we do dynamic fallback to bulk local save.
  try {
    for (const item of cleanItems) {
      const payload = {
        resi: item.resi,
        sender: item.sender,
        receiver: item.receiver,
        destination: item.destination,
        weight: Number(item.weight),
        courier: item.courier,
        status: item.status
      };

      await api.post('/cutoff-inbounds', payload);
      uploadCount++;
    }

    showNotification(`Berhasil upload ${uploadCount} baris ke REST API!`, 'success');
    await fetchInboundApi();
  } catch (err) {
    apiFailed = true;
    console.warn('Batch upload API offline/failed. Saving data locally.');
  } finally {
    apiLoading.value = false;
  }

  if (apiFailed) {
    // Local flow save
    store.importData('inbound', cleanItems);
    showNotification(`Impor Lokal Sukses! ${cleanItems.length} data tersimpan di local WMS.`, 'success');
  }

  discardDraft();
}

function discardDraft() {
  rawParsedItems.value = [];
  validationErrors.value = [];
  totalParsedRows.value = 0;
  activeUploadedFileName.value = '';
}

function resetForm() {
  formResi.value = '';
  formSender.value = '';
  formReceiver.value = '';
  formDestination.value = '';
  formWeight.value = null;
  formCourier.value = '';
  formStatus.value = 'pending';
  showForm.value = false;
}

function onClearData() {
  if (confirm(`Apakah Anda yakin ingin menghapus seluruh data Inbound? Tindakan ini bersifat permanen.`)) {
    store.clearData('inbound');
    showNotification('Semua data inbound lokal telah dibersihkan.', 'info');
  }
}

// Columns definition for table display matching types
const columns = [
  { key: 'resi', label: 'No Resi', type: 'string' },
  { key: 'sender', label: 'Pengirim', type: 'string' },
  { key: 'receiver', label: 'Penerima', type: 'string' },
  { key: 'destination', label: 'Kota Tujuan', type: 'string' },
  { key: 'weight', label: 'Berat (Kg)', type: 'number' },
  { key: 'courier', label: 'Kurir', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' }
];

// Load on mount
onMounted(() => {
  fetchInboundApi();
});
</script>

<template>
  <div id="inbound-menu-comp" class="space-y-6">
    <!-- Floating Notification Banner -->
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
              <h3 class="text-sm font-bold text-slate-900 border-none">Integrasi REST API</h3>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border"
                :class="apiError ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'"
              >
                {{ apiError ? 'API Offline (Fallback Lokal)' : 'API Terhubung' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 max-w-lg leading-relaxed mt-1">
              Data outbound/inbound disinkronisasikan berulang melalui endpoint 
              <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">127.0.0.1:8000/api/cutoff-inbounds</code>.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            id="btn-show-form"
            type="button"
            class="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition select-none cursor-pointer"
            @click="showForm = !showForm"
          >
            <ListPlus class="w-4 h-4" />
            {{ showForm ? 'Tutup Formulir' : 'Input Manual' }}
          </button>

          <button 
            id="btn-sync-inbound"
            type="button" 
            class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer disabled:opacity-50 select-none"
            :disabled="apiLoading"
            @click="fetchInboundApi"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{'animate-spin': apiLoading}" />
            {{ apiLoading ? 'Menghubungkan...' : 'Sinkronkan API' }}
          </button>
        </div>
      </div>

      <!-- Sync feedback States -->
      <div v-if="apiSuccess" class="p-3.5 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2.5">
        <CheckCircle2 class="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
        <div class="text-xs text-green-800 space-y-0.5 leading-relaxed">
          <p class="font-bold">Koneksi Berhasil!</p>
          <p>Membaca database inbounds secara aktif pada pukul <b>{{ lastFetchTime }}</b>.</p>
        </div>
      </div>

      <div v-if="apiError" class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-amber-900 space-y-1.5 leading-relaxed">
          <p class="font-bold">Gagal Terhubung ke http://127.0.0.1:8000/api/cutoff-inbounds</p>
          <p class="text-2xs text-slate-500">Aplikasi Anda dikonfigurasi untuk melakukan integrasi REST API secara real-time. Jika server lokal di port 8000 belum menyala, sistem menggunakan dummy tracker (Pinia) agar Anda tetap bisa melakukan demo lancar.</p>
        </div>
      </div>

      <!-- Manual Input Form Segment -->
      <div 
        v-if="showForm" 
        class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 animate-fade-in"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <h4 class="text-xs font-bold text-slate-800 uppercase tracking-widest">Input Inbound Manual (POST ke API)</h4>
          <span class="text-3xs text-slate-400 font-bold">Inbound Logistik</span>
        </div>

        <form @submit.prevent="submitInbound" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Resi -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">No Resi *</label>
            <input 
              v-model="formResi" 
              type="text" 
              placeholder="Contoh: RESI918239" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Sender -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Pengirim / Merchant *</label>
            <input 
              v-model="formSender" 
              type="text" 
              placeholder="Contoh: Tokopedia HQ" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Receiver -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Penerima *</label>
            <input 
              v-model="formReceiver" 
              type="text" 
              placeholder="Nama Penerima" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Destination -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Kota Tujuan *</label>
            <input 
              v-model="formDestination" 
              type="text" 
              placeholder="Contoh: South Jakarta" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Weight -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Berat (Kg) *</label>
            <input 
              v-model="formWeight" 
              type="number" 
              step="0.1" 
              min="0.1"
              placeholder="Contoh: 1.5" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Courier -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Nama Kurir *</label>
            <input 
              v-model="formCourier" 
              type="text" 
              placeholder="Contoh: Andi" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Status -->
          <div class="space-y-1 col-span-1 md:col-span-2 lg:col-span-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Status Inbound</label>
            <select 
              v-model="formStatus" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>

          <!-- Submit Button -->
          <div class="flex items-end col-span-1 md:col-span-2 lg:col-span-1">
            <button 
              id="btn-add-inbound-submit"
              type="submit" 
              class="w-full py-2 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
              :disabled="isCreating"
            >
              <Loader2 v-if="isCreating" class="w-3.5 h-3.5 animate-spin" />
              <Send v-else class="w-3.5 h-3.5" />
              {{ isCreating ? 'Menyimpan...' : 'Kirim Ke Server' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- CSV Uploader Area -->
    <FileUpload 
      menu-key="inbound"
      menu-label="Inbound Cutoff Logistik"
      :has-data="store.inbound.length > 0"
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
          Preview Database Terpasang (Total: {{ store.inbound.length }})
        </h3>
        <span class="text-2xs font-semibold text-slate-500 font-sans">Terakhir Disinkron: REST API & Storage</span>
      </div>

      <DataPreviewTable 
        :items="store.inbound"
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
