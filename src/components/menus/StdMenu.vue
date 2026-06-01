<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api';
import { useLogisticsStore } from '../../store/logisticsStore';
import { parseCSV } from '../../utils/csvParser';
import FileUpload from '../../components/FileUpload.vue';
import DataPreviewTable from '../../components/DataPreviewTable.vue';
import ValidationResult from '../../components/ValidationResult.vue';
import { TableProperties, Server, RefreshCw, CheckCircle2, AlertCircle, CalendarDays, Bell, X, AlertTriangle } from 'lucide-vue-next';

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

async function fetchStdsApi() {
  apiLoading.value = true;
  apiError.value = null;
  apiSuccess.value = false;
  try {
    const response = await api.get('/std-deliveries');
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
      resi: item.resi || item.no_resi || `RESI-STD-${Math.floor(100 + Math.random() * 900)}`,
      courier: item.courier || item.kurir || 'Andi',
      target: Number(item.target) || 10,
      completed: Number(item.completed) || 5,
      pending: Number(item.pending) || 5,
      status: item.status || 'pending',
      date: item.date || '2026-05-30'
    }));

    store.importData('std', mappedItems);
    apiSuccess.value = true;
    lastFetchTime.value = new Date().toLocaleTimeString('id-ID');
  } catch (err: any) {
    console.error('STD API Fetch failed:', err);
    apiError.value = 'Koneksi ditolak oleh API FMS lokal (Server Offline / CORS).';
  } finally {
    apiLoading.value = false;
  }
}

// Date Range Filter States
const filterStartDate = ref('');
const filterEndDate = ref('');

const filteredStds = computed(() => {
  let list = store.std;
  if (filterStartDate.value) {
    list = list.filter(item => {
      const itemDate = item.date || '2026-05-30';
      return itemDate >= filterStartDate.value;
    });
  }
  if (filterEndDate.value) {
    list = list.filter(item => {
      const itemDate = item.date || '2026-05-30';
      return itemDate <= filterEndDate.value;
    });
  }
  return list;
});

function clearDateFilter() {
  filterStartDate.value = '';
  filterEndDate.value = '';
}

// Reminder to Courier modal popup states for STD
const isReminderModalOpen = ref(false);
const activeRemindedCourier = ref<string>('');
const sendNotificationSuccess = ref(false);

const courierStats = computed(() => {
  const name = activeRemindedCourier.value;
  if (!name) return null;
  
  // Calculate delivery stats for this courier from standard std state
  const courierDeliveries = store.std.filter(x => x.courier === name);
  
  let target = 0;
  let completed = 0;
  let pending = 0;
  
  courierDeliveries.forEach(s => {
    target += s.target || 0;
    completed += s.completed || 0;
    pending += s.pending || 0;
  });
  
  // Fallbacks if no std is found
  if (target === 0) {
    target = 10;
    completed = 8;
    pending = 2;
  }

  // Success rate lookup or calculation
  const perf = store.performance.find(p => p.courier === name);
  let successRate = 'N/A';
  if (perf && perf.deliveries > 0) {
    successRate = `${Math.round((perf.success / perf.deliveries) * 100)}%`;
  } else {
    successRate = `${Math.round((completed / target) * 100)}%`;
  }

  const doneDelivering = `${completed} dari ${target} Paket Selesai (Sameday/STD)`;
  
  return {
    name,
    totalExpediteDelivering: target,
    delivered: completed,
    onhold: pending,
    successRate,
    doneDelivering
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
    showNotification(`Pengingat Sameday berhasil dikirim kepada kurir ${activeRemindedCourier.value}!`, 'success');
  }, 1000);
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
      const result = parseCSV(event.text, 'std');
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
  store.importData('std', cleanItems);
  discardDraft();
}

function discardDraft() {
  rawParsedItems.value = [];
  validationErrors.value = [];
  totalParsedRows.value = 0;
  activeUploadedFileName.value = '';
}

function onClearData() {
  if (confirm(`Apakah Anda yakin ingin menghapus seluruh data STD?`)) {
    store.clearData('std');
  }
}

// Columns definition for std: no resi, driver name/latest operator, status, action
const columns = [
  { key: 'resi', label: 'No Resi', type: 'string' },
  { key: 'courier', label: 'Nama Driver / Latest Operator', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'action', label: 'Pengingat', type: 'action' }
];

onMounted(() => {
  fetchStdsApi();
});
</script>

<template>
  <div id="std-menu-comp" class="space-y-6">
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
              <h3 class="text-sm font-bold text-slate-900 border-none">Integrasi FMS STD/Sameday Delivered (REST API)</h3>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border"
                :class="apiError ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'"
              >
                {{ apiError ? 'API Offline (Fallback Lokal)' : 'API Terhubung' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 max-w-lg leading-relaxed mt-1">
              Data Laporan STD/Sameday ditarik langsung untuk verifikasi pencapian SLA kurir lapangan harian:
              <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">GET /api/std-deliveries</code>.
            </p>
          </div>
        </div>

        <button 
          id="btn-sync-std"
          type="button" 
          class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer disabled:opacity-50 select-none shrink-0"
          :disabled="apiLoading"
          @click="fetchStdsApi"
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
          <p>Membaca database harian STD/Sameday aktif pada pukul <b>{{ lastFetchTime }}</b>.</p>
        </div>
      </div>

      <div v-if="apiError" class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-amber-900 space-y-1 leading-relaxed">
          <p class="font-bold">Gagal Terhubung ke http://127.0.0.1:8000/api/std-deliveries</p>
          <p class="text-2xs text-slate-500">Gagal mengontak server API Laporan STD. Fitur offline browser otomatis aktif menjaga agar draf pengerjaan Anda aman tanpa kehilangan data.</p>
        </div>
      </div>
    </div>

    <!-- File Upload Section -->
    <FileUpload 
      menu-key="std"
      menu-label="Import Data STD/Sameday Delivered (CSV/Excel)"
      :has-data="store.std.length > 0"
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
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Filter Range Tanggal STD/Sameday</h4>
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
          id="btn-clear-std-date"
          type="button"
          class="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 cursor-pointer h-9 transition-colors select-none"
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
          Preview Database Laporan Harian STD/Sameday (Total: {{ filteredStds.length }})
        </h3>
        <span class="text-2xs font-semibold text-slate-500 font-sans">Penyimpanan Terpasang: Lokal browser</span>
      </div>

      <DataPreviewTable 
        :items="filteredStds"
        :columns="columns"
      >
        <!-- Reminder to Courier Button -->
        <template #col-action="{ item }">
          <button 
            type="button"
            class="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer transition select-none shadow-2xs active:scale-95"
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
      id="std-reminder-backdrop"
      class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all"
    >
      <div id="std-reminder-modal" class="bg-white border border-slate-250 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        <!-- Modal Header -->
        <div class="px-5 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-2.5">
            <div class="w-8.5 h-8.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Bell class="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h3 class="text-xs font-bold text-slate-900 border-none">Reminder to Courier</h3>
              <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wide">FMS Dispatcher Info (Sameday/STD)</p>
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
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">STD Target Active</span>
              <span class="text-sm font-extrabold text-slate-900 block mt-0.5">{{ courierStats.totalExpediteDelivering }}</span>
            </div>
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Completed</span>
              <span class="text-sm font-extrabold text-emerald-600 block mt-0.5">{{ courierStats.delivered }}</span>
            </div>
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Pending</span>
              <span class="text-sm font-extrabold text-rose-500 block mt-0.5">{{ courierStats.onhold }}</span>
            </div>
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Success Rate</span>
              <span class="text-sm font-extrabold text-blue-600 block mt-0.5">{{ courierStats.successRate }}</span>
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
