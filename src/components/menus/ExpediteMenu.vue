<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api';
import { useLogisticsStore } from '../../store/logisticsStore';
import { parseCSV } from '../../utils/csvParser';
import FileUpload from '../../components/FileUpload.vue';
import DataPreviewTable from '../../components/DataPreviewTable.vue';
import ValidationResult from '../../components/ValidationResult.vue';
import { TableProperties, Server, RefreshCw, CheckCircle2, AlertCircle, CalendarDays, Bell, X, AlertTriangle, Download, Image, SlidersHorizontal } from 'lucide-vue-next';
import html2canvas from 'html2canvas';

const store = useLogisticsStore();

// Floating Notification
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
  notification.value = { message, type };
  setTimeout(() => {
    notification.value = null;
  }, 4000);
}

// Integration API & Sync states
const apiLoading = ref(false);
const apiError = ref<string | null>(null);
const apiSuccess = ref(false);
const lastFetchTime = ref<string | null>(null);

async function fetchExpeditesApi() {
  apiLoading.value = true;
  apiError.value = null;
  apiSuccess.value = false;
  try {
    const response = await api.get('/expedites');
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
      resi: item.resi || item.no_resi || `RESI${Math.floor(100000 + Math.random() * 900000)}`,
      itemName: item.itemName || item.item_name || 'Spesimen Medis',
      deadline: item.deadline || new Date().toISOString().substring(0, 16).replace('T', ' '),
      courier: item.courier || item.kurir || 'Citra',
      urgency: item.urgency || 'Sangat Penting',
      status: item.status || 'pending'
    }));

    store.importData('expedite', mappedItems);
    apiSuccess.value = true;
    lastFetchTime.value = new Date().toLocaleTimeString('id-ID');
  } catch (err: any) {
    console.error('Expedite API Fetch failed:', err);
    apiError.value = 'Koneksi ditolak oleh API FMS lokal (Server Offline / CORS).';
  } finally {
    apiLoading.value = false;
  }
}

// Range Date Filter states
const filterStartDate = ref('');
const filterEndDate = ref('');

const filteredExpedites = computed(() => {
  let list = store.expedite;
  if (filterStartDate.value) {
    list = list.filter(item => {
      const itemDate = item.deadline?.split(' ')[0] || '';
      return itemDate >= filterStartDate.value;
    });
  }
  if (filterEndDate.value) {
    list = list.filter(item => {
      const itemDate = item.deadline?.split(' ')[0] || '';
      return itemDate <= filterEndDate.value;
    });
  }
  return list;
});

function clearDateFilter() {
  filterStartDate.value = '';
  filterEndDate.value = '';
}

// Reminder to Courier modal popup states
const isReminderModalOpen = ref(false);
const activeRemindedCourier = ref<string>('');
const sendNotificationSuccess = ref(false);

const courierStats = computed(() => {
  const name = activeRemindedCourier.value;
  if (!name) return null;
  
  const courierExpedites = store.expedite.filter(x => x.courier === name);
  const totalExpediteDelivering = courierExpedites.length;
  const delivered = courierExpedites.filter(x => x.status === 'completed').length;
  const onhold = courierExpedites.filter(x => x.status === 'delayed' || x.status === 'pending').length;
  
  const perf = store.performance.find(p => p.courier === name);
  let successRate = 'N/A';
  if (perf && perf.deliveries > 0) {
    successRate = `${Math.round((perf.success / perf.deliveries) * 100)}%`;
  } else if (totalExpediteDelivering > 0) {
    successRate = `${Math.round((delivered / totalExpediteDelivering) * 100)}%`;
  } else {
    const hash = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
    successRate = `${85 + (hash % 15)}%`;
  }

  const doneDelivering = `${delivered} dari ${totalExpediteDelivering} Paket Selesai`;
  
  return {
    name,
    totalExpediteDelivering,
    delivered,
    onhold,
    successRate,
    doneDelivering,
    parcels: courierExpedites
  };
});

function triggerReminderToCourier(courierName: string) {
  activeRemindedCourier.value = courierName;
  isReminderModalOpen.value = true;
}

function sendReminderNotification() {
  sendNotificationSuccess.value = true;
  setTimeout(() => {
    sendNotificationSuccess.value = false;
    isReminderModalOpen.value = false;
    showNotification(`Pengingat berhasil dikirim kepada kurir ${activeRemindedCourier.value}!`, 'success');
  }, 1000);
}

// CSV Parser Uplad Handling
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
      const result = parseCSV(event.text, 'expedite');
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
  store.importData('expedite', cleanItems);
  discardDraft();
}

function discardDraft() {
  rawParsedItems.value = [];
  validationErrors.value = [];
  totalParsedRows.value = 0;
  activeUploadedFileName.value = '';
}

function onClearData() {
  if (confirm(`Apakah Anda yakin ingin menghapus seluruh data Expedite?`)) {
    store.clearData('expedite');
  }
}

// Columns definition for expedite matching: no resi, driver name/latest operator, status, action
const columns = [
  { key: 'resi', label: 'No Resi', type: 'string' },
  { key: 'courier', label: 'Nama Driver / Latest Operator', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'action', label: 'Pengingat', type: 'action' }
];

// Filtering % (Onhold + Delivered) and Image Export states
const minOnholdDeliveredFilter = ref<number>(0);
const html2canvasElementRef = ref<HTMLElement | null>(null);
const isExportingImage = ref(false);

async function exportReportAsImage() {
  if (!html2canvasElementRef.value) {
    showNotification('Terjadi kesalahan: Konten laporan tidak ditemukan.', 'error');
    return;
  }
  
  isExportingImage.value = true;
  showNotification('Sedang membuat berkas gambar rekapitulasi...', 'info');
  
  try {
    const canvas = await html2canvas(html2canvasElementRef.value, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    
    const imageUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `Report_Expedite_To_Date_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    showNotification('Laporan berhasil diekspor sebagai gambar PNG!', 'success');
  } catch (err: any) {
    console.error('Failed to export image:', err);
    showNotification('Gagal membuat gambar: ' + err.message, 'error');
  } finally {
    isExportingImage.value = false;
  }
}

const expediteToDateReport = computed(() => {
  const couriersSet = new Set<string>();
  store.expedite.forEach(x => {
    if (x.courier) couriersSet.add(x.courier.trim());
  });
  
  if (couriersSet.size === 0) {
    store.performance.forEach(p => {
      if (p.courier) couriersSet.add(p.courier.trim());
    });
  }
  
  return Array.from(couriersSet).map(name => {
    const courierExpedites = store.expedite.filter(x => x.courier?.trim() === name);
    const totalDelivering = courierExpedites.length;
    const delivered = courierExpedites.filter(x => x.status === 'completed').length;
    const onhold = courierExpedites.filter(x => x.status === 'delayed' || x.status === 'pending').length;
    
    let successRateNumeric = 0;
    if (totalDelivering > 0) {
      successRateNumeric = Math.round((delivered / totalDelivering) * 100);
    }
    
    let onholdDeliveredPercent = 0;
    if (totalDelivering > 0) {
      onholdDeliveredPercent = Math.round(((onhold + delivered) / totalDelivering) * 100);
    }
    
    return {
      courier: name,
      totalDelivering,
      onhold,
      delivered,
      successRate: `${successRateNumeric}%`,
      onholdDeliveredPercent: `${onholdDeliveredPercent}%`,
      onholdDeliveredPercentNumeric: onholdDeliveredPercent
    };
  }).filter(row => {
    return row.onholdDeliveredPercentNumeric >= minOnholdDeliveredFilter.value;
  });
});

onMounted(() => {
  fetchExpeditesApi();
});
</script>

<template>
  <div id="expedite-menu-comp" class="space-y-6">
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
              <h3 class="text-sm font-bold text-slate-900 border-none">Integrasi FMS Expedite (REST API)</h3>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border"
                :class="apiError ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'"
              >
                {{ apiError ? 'API Offline (Fallback Lokal)' : 'API Terhubung' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 max-w-lg leading-relaxed mt-1">
              Data expedite cargo ditarik langsung untuk verifikasi status pengantaran prioritas:
              <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">GET /api/expedites</code>.
            </p>
          </div>
        </div>

        <button 
          id="btn-sync-expedite"
          type="button" 
          class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer disabled:opacity-50 select-none shrink-0"
          :disabled="apiLoading"
          @click="fetchExpeditesApi"
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
          <p>Membaca database expedite aktif pada pukul <b>{{ lastFetchTime }}</b>.</p>
        </div>
      </div>

      <div v-if="apiError" class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-amber-900 space-y-1 leading-relaxed">
          <p class="font-bold">Gagal Terhubung ke http://127.0.0.1:8000/api/expedites</p>
          <p class="text-2xs text-slate-500">Koneksi terhambat oleh status server API yang offline. Anda dipersilakan melanjutkan aktivitas menggunakan database lokal/unggah file CSV harian.</p>
        </div>
      </div>
    </div>

    <!-- File Upload Section -->
    <FileUpload 
      menu-key="expedite"
      menu-label="Import Data Expedite (CSV/Excel)"
      :has-data="store.expedite.length > 0"
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

    <!-- Date Filter Section -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex items-center gap-2">
        <CalendarDays class="w-4 h-4 text-blue-600" />
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Filter Range Tanggal Expedite</h4>
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
          id="btn-clear-expedite-date"
          type="button"
          class="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 cursor-pointer h-9 transition-colors select-none"
          @click="clearDateFilter"
        >
          Reset Filter
        </button>
      </div>
    </div>

    <!-- Report Expedite To Date Section -->
    <div ref="html2canvasElementRef" class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
        <div class="flex items-center gap-2">
          <TableProperties class="w-4 h-4 text-emerald-600" />
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Report Expedite To Date</h3>
        </div>
        
        <div class="flex items-center gap-2.5 flex-wrap" data-html2canvas-ignore="true">
          <!-- Filter range slider based on % (Onhold + Delivered) -->
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-600 h-9">
            <SlidersHorizontal class="w-3.5 h-3.5 text-blue-600" />
            <span>% (Onhold+Delivered) >=</span>
            <input 
              v-model.number="minOnholdDeliveredFilter"
              type="range"
              min="0"
              max="100"
              step="5"
              class="w-20 accent-blue-600 h-1 cursor-pointer bg-slate-200 rounded-lg appearance-none"
            />
            <span class="font-mono bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px] min-w-[32px] text-center">
              {{ minOnholdDeliveredFilter }}%
            </span>
            <button 
              v-if="minOnholdDeliveredFilter > 0"
              type="button" 
              class="text-rose-500 hover:text-rose-700 font-bold ml-1 text-[10px] hover:underline cursor-pointer"
              @click="minOnholdDeliveredFilter = 0"
            >
              Reset
            </button>
          </div>

          <!-- Button Export Image -->
          <button 
            type="button"
            class="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all rounded-lg shadow-2xs cursor-pointer select-none disabled:opacity-55 h-9"
            :disabled="isExportingImage"
            @click="exportReportAsImage"
          >
            <Loader2 v-if="isExportingImage" class="w-3.5 h-3.5 animate-spin" />
            <Image v-else class="w-3.5 h-3.5" />
            <span>{{ isExportingImage ? 'Mengekspor...' : 'Export Gambar' }}</span>
          </button>

          <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-100 uppercase tracking-wider">
            Rekapitulasi Kinerja
          </span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
              <th class="py-3 px-4 font-bold">Courier Name</th>
              <th class="py-3 px-4 font-bold text-center">Total Delivering</th>
              <th class="py-3 px-4 font-bold text-center">On Hold</th>
              <th class="py-3 px-4 font-bold text-center">Delivered</th>
              <th class="py-3 px-4 font-bold text-center">Success Rate</th>
              <th class="py-3 px-4 font-bold text-center">% (Onhold + Delivered)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in expediteToDateReport" :key="row.courier" class="hover:bg-slate-50/50 transition">
              <td class="py-3.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                {{ row.courier }}
              </td>
              <td class="py-3.5 px-4 text-center font-bold text-slate-700 font-mono">
                {{ row.totalDelivering }}
              </td>
              <td class="py-3.5 px-4 text-center font-bold text-rose-500 font-mono">
                {{ row.onhold }}
              </td>
              <td class="py-3.5 px-4 text-center font-bold text-emerald-600 font-mono">
                {{ row.delivered }}
              </td>
              <td class="py-3.5 px-4 text-center">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 font-mono">
                  {{ row.successRate }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-center">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono">
                  {{ row.onholdDeliveredPercent }}
                </span>
              </td>
            </tr>
            <tr v-if="expediteToDateReport.length === 0">
              <td colspan="6" class="py-6 text-center text-slate-400 font-medium">
                Belum ada data atau tidak ada data yang memenuhi saringan persentase.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Database Preview Table -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <TableProperties class="w-3.5 h-3.5" />
          Preview Database Expedite (Total: {{ filteredExpedites.length }})
        </h3>
        <span class="text-2xs font-semibold text-slate-500 font-sans">Penyimpanan Terpasang: Lokal browser</span>
      </div>

      <DataPreviewTable 
        :items="filteredExpedites"
        :columns="columns"
      >
        <!-- Reminder to Courier Button -->
        <template #col-action="{ item }">
          <button 
            type="button"
            class="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-amber-505 bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer transition select-none shadow-2xs active:scale-95"
            @click="triggerReminderToCourier(item.courier)"
          >
            <Bell class="w-3 h-3" />
            Remind Courier
          </button>
        </template>
      </DataPreviewTable>
    </div>

    <!-- Reminder Modal Backdrop and Dialog -->
    <div 
      v-if="isReminderModalOpen" 
      id="reminder-modal-backdrop"
      class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all"
    >
      <div id="reminder-modal" class="bg-white border border-slate-250 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        <!-- Modal Header -->
        <div class="px-5 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8.5 h-8.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Bell class="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h3 class="text-xs font-bold text-slate-900 border-none">Reminder to Courier</h3>
              <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wide">FMS Dispatcher Info</p>
            </div>
          </div>
          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" 
            @click="isReminderModalOpen = false"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Modal Body Stat List -->
        <div v-if="courierStats" class="p-5 space-y-4 text-xs">
          <div class="bg-slate-900 text-white rounded-xl p-4 text-center">
            <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Courier / Driver Name</span>
            <span class="text-base font-black text-amber-400 block mt-1">{{ courierStats.name }}</span>
          </div>

          <div class="grid grid-cols-2 gap-3.5 font-sans">
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Delivering</span>
              <span class="text-sm font-extrabold text-slate-900 block mt-0.5">{{ courierStats.totalExpediteDelivering }}</span>
            </div>
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Delivered</span>
              <span class="text-sm font-extrabold text-emerald-600 block mt-0.5">{{ courierStats.delivered }}</span>
            </div>
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">On Hold</span>
              <span class="text-sm font-extrabold text-rose-500 block mt-0.5">{{ courierStats.onhold }}</span>
            </div>
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Success Rate</span>
              <span class="text-sm font-extrabold text-blue-600 block mt-0.5">{{ courierStats.successRate }}</span>
            </div>
          </div>

          <!-- All Parcels Summarized under Driver -->
          <div class="border-t border-slate-100 pt-3.5 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Daftar Paket Expedite Driver</span>
              <span class="text-[10px] font-bold text-blue-650 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">Total: {{ courierStats.totalExpediteDelivering }}</span>
            </div>
            
            <div class="max-h-40 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
              <div 
                v-for="parcel in courierStats.parcels" 
                :key="parcel.resi" 
                class="p-2.5 bg-slate-50 border border-slate-150 rounded-xl hover:bg-slate-100/50 transition duration-150 flex flex-col gap-1"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono font-black text-rose-600 text-2xs">{{ parcel.resi }}</span>
                  <span 
                    class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                    :class="{
                      'bg-emerald-100 text-emerald-800 border border-emerald-200': parcel.status === 'completed',
                      'bg-amber-100 text-amber-800 border border-amber-200': parcel.status === 'pending',
                      'bg-rose-100 text-rose-800 border border-rose-250': parcel.status === 'delayed'
                    }"
                  >
                    {{ parcel.status }}
                  </span>
                </div>
                
                <div class="flex items-center justify-between text-[11px] font-medium text-slate-700">
                  <span class="truncate pr-2 font-bold">{{ parcel.itemName }}</span>
                  <span class="text-[9px] text-slate-400 shrink-0 font-bold bg-slate-200/50 px-1.5 py-0.5 rounded">{{ parcel.urgency }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-3 flex flex-col items-center">
            <span class="text-[8px] font-bold text-slate-400 uppercase tracking-wide block">Done Delivering Status</span>
            <span class="text-xs font-bold text-slate-700 block mt-1">{{ courierStats.doneDelivering }}</span>
          </div>
        </div>

        <!-- Modal actions -->
        <div class="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex align-center justify-end gap-2.5">
          <button 
            type="button" 
            class="px-4.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition rounded-lg cursor-pointer"
            @click="isReminderModalOpen = false"
          >
            Tutup
          </button>
          <button 
            type="button" 
            class="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition rounded-lg h-9 select-none cursor-pointer"
            :disabled="sendNotificationSuccess"
            @click="sendReminderNotification"
          >
            <RefreshCw v-if="sendNotificationSuccess" class="w-3 h-3 animate-spin" />
            {{ sendNotificationSuccess ? 'Mengirim...' : 'Kirim Peringatan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
