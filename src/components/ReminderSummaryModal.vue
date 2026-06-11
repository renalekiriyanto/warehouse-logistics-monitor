<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import stdSomedayService from '../services/stdSomedayService';
import { useLogisticsStore } from '../store/logisticsStore';
import * as XLSX from 'xlsx';
import { 
  X, Bell, Calendar, Users, FileSpreadsheet, Copy, Check, Download, 
  AlertCircle, Loader2, Filter, CheckCircle2 
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const store = useLogisticsStore();

// UI State controls
const isLoading = ref(false);
const isCopying = ref(false);
const isExporting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Optional Filter option
const filterOnlyActive = ref(false);

// Modal raw data
const generatedAt = ref('-');
const totalCourier = ref(0);
const totalAwb = ref(0);
const driversSummary = ref<any[]>([]);

// Fetch courier summary from API
async function loadSummaryData() {
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  
  try {
    const response = await stdSomedayService.getReminderCourier();
    if (response && response.success && Array.isArray(response.data)) {
      const list = response.data;
      driversSummary.value = list;
      
      if (list.length > 0) {
        // Ambil date dari response pertama
        const first = list[0];
        generatedAt.value = first.date || '-';
      } else {
        generatedAt.value = '-';
      }
    } else {
      throw new Error('Respon API reminder format tidak sesuai atau kosong.');
    }
  } catch (err: any) {
    console.warn('Layanan POST /api/std-somedays/reminder-courier terputus, memproses draf local store...', err);
    computeLocalFallbackSummary();
  } finally {
    isLoading.value = false;
  }
}

// Fallback logic calculation from store state
function computeLocalFallbackSummary() {
  const list = store.std || [];
  const driversMap: Record<string, any> = {};
  let totalCount = 0;

  list.forEach(item => {
    const driverVal = item.driver_name || item.courier || item.id_driver || 'N/A';
    if (!driversMap[driverVal]) {
      driversMap[driverVal] = {
        driver_name: driverVal,
        awb_count: 0,
        delivering: 0,
        onhold: 0,
        delivered: 0,
        pct_delivered: 0
      };
    }

    driversMap[driverVal].awb_count++;
    totalCount++;

    const status = String(item.status || '').toLowerCase();
    if (status === 'completed' || status === 'delivered') {
      driversMap[driverVal].delivered++;
    } else if (status === 'delayed' || status === 'onhold' || status === 'on hold' || status === 'on_hold') {
      driversMap[driverVal].onhold++;
    } else {
      driversMap[driverVal].delivering++;
    }
  });

  const driversList = Object.values(driversMap);
  driversList.forEach(d => {
    if (d.awb_count > 0) {
      d.pct_delivered = (d.delivered / d.awb_count) * 100;
    }
  });

  const now = new Date();
  const formattedTime = String(now.getDate()).padStart(2, '0') + '/' +
    String(now.getMonth() + 1).padStart(2, '0') + '/' +
    now.getFullYear();

  generatedAt.value = formattedTime;
  totalCourier.value = driversList.length;
  totalAwb.value = totalCount;
  driversSummary.value = driversList;
}

// Composition logic: Filter and Priority Sort
const processedDrivers = computed(() => {
  const rawList = [...driversSummary.value];

  // Map to normalize and determine percent delivered
  const normalizedList = rawList.map(item => {
    const driverName = item.driver_name || item.driver || 'N/A';
    const total_awb = Number(item.awb_count ?? item.total_awb ?? 0);
    const delivering = Number(item.delivering ?? 0);
    const on_hold = Number(item.onhold ?? item.on_hold ?? 0);
    const delivered = Number(item.delivered ?? 0);
    const pct_delivered = Number(item.pct_delivered ?? (total_awb > 0 ? (delivered / total_awb) * 100 : 0));

    return {
      driver: driverName,
      total_awb,
      delivering,
      on_hold,
      delivered,
      pct_delivered
    };
  });

  // Filter: Delivering > 0 if checked
  let result = normalizedList;
  if (filterOnlyActive.value) {
    result = normalizedList.filter(d => d.delivering > 0);
  }

  // Priority Sorting logic:
  // 1. Delivering (Proses) descending
  // 2. On Hold (Tertunda) descending
  // 3. Driver Name alphabetically ascending
  return result.sort((a, b) => {
    if (b.delivering !== a.delivering) {
      return b.delivering - a.delivering;
    }
    if (b.on_hold !== a.on_hold) {
      return b.on_hold - a.on_hold;
    }
    return a.driver.localeCompare(b.driver);
  });
});

// Dynamic summary statistics computed from calculated state
const computedTotalCourier = computed(() => processedDrivers.value.length);
const computedTotalAwb = computed(() => processedDrivers.value.reduce((acc, curr) => acc + curr.total_awb, 0));
const computedTotalDelivering = computed(() => processedDrivers.value.reduce((acc, curr) => acc + curr.delivering, 0));
const computedTotalOnHold = computed(() => processedDrivers.value.reduce((acc, curr) => acc + curr.on_hold, 0));
const computedTotalDelivered = computed(() => processedDrivers.value.reduce((acc, curr) => acc + curr.delivered, 0));

// Formatted WhatsApp reminder template builder
const whatsappMessageBody = computed(() => {
  let cleanTime = generatedAt.value;
  try {
    if (cleanTime && cleanTime !== '-' && cleanTime.includes('-')) {
      const parts = cleanTime.split('-');
      if (parts.length === 3) {
        const yyyy = parts[0];
        const mm = parts[1];
        const dd = parts[2];
        if (yyyy.length === 4) {
          cleanTime = `${dd}/${mm}/${yyyy}`;
        }
      }
    }
  } catch (err) {
    console.warn('Tanggal gagal diformat:', err);
  }

  let text = `📦 REMINDER STD SOMEDAY\n\n`;
  text += `📅 Update:\n${cleanTime}\n\n`;
  text += `━━━━━━━━━━━━━━\n\n`;

  processedDrivers.value.forEach(d => {
    text += `🚚 ${d.driver.toUpperCase()}\n\n`;
    text += `• Total AWB : ${d.total_awb}\n`;
    text += `• Delivering : ${d.delivering}\n`;
    text += `• On Hold : ${d.on_hold}\n`;
    text += `• Delivered : ${d.delivered}\n`;
    text += `• % Delivered : ${d.pct_delivered.toFixed(2)}%\n\n`;
    text += `━━━━━━━━━━━━━━\n\n`;
  });

  text += `⚠ Mohon update paket yang masih berstatus Delivering dan On Hold.\n\n`;
  text += `Terima kasih.`;
  return text;
});

// Copy Message with Clipboard API
async function copyWhatsAppReminder() {
  isCopying.value = true;
  errorMessage.value = null;
  successMessage.value = null;

  try {
    let textToCopy = '';
    
    try {
      // Prioritize endpoint generated message if available, otherwise build local template
      const response = await stdSomedayService.getReminderMessage();
      if (response && response.success && response.data && !filterOnlyActive.value) {
        textToCopy = (response.data as any).message || '';
      }
    } catch (apiErr) {
      console.warn('Gagal memanggil GET /api/std-somedays/reminder-message, format pesan lokal digunakan.', apiErr);
    }

    if (!textToCopy || filterOnlyActive.value) {
      textToCopy = whatsappMessageBody.value;
    }

    // Modern clipboard copier
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
      successMessage.value = 'Reminder berhasil disalin';
    } else {
      // Standard textarea selection copy method
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        successMessage.value = 'Reminder berhasil disalin';
      } else {
        throw new Error('Eksekusi clipboard disalin gagal.');
      }
    }
  } catch (err: any) {
    console.error('Penyalinan clipboard gagal:', err);
    errorMessage.value = 'Sistem gagal mendaftarkan teks ke clipboard.';
  } finally {
    isCopying.value = false;
    setTimeout(() => {
      successMessage.value = null;
    }, 3000);
  }
}

// Excel Export
function exportSummaryToExcel() {
  isExporting.value = true;
  errorMessage.value = null;

  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datestr = `${yyyy}${mm}${dd}`;
    const filename = `STD_SAMEDAY_REMINDER_${datestr}.xlsx`;

    // Map rows matching defined columns
    const sheetData = processedDrivers.value.map(item => ({
      'Driver Name': item.driver,
      'Total AWB': item.total_awb,
      'Delivering': item.delivering,
      'OnHold': item.on_hold,
      'Delivered': item.delivered
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reminder Summary');
    
    worksheet['!cols'] = [
      { wch: 22 }, // Driver Name
      { wch: 12 }, // Total AWB
      { wch: 12 }, // Delivering
      { wch: 12 }, // OnHold
      { wch: 12 }  // Delivered
    ];

    XLSX.writeFile(workbook, filename);
    successMessage.value = 'Dokumen Excel reminder berhasil diunduh!';
  } catch (err: any) {
    console.error('Ekspor Excel kargo gagal:', err);
    errorMessage.value = 'Gagal menyimpan file Excel ke penyimpanan lokal.';
  } finally {
    isExporting.value = false;
    setTimeout(() => {
      successMessage.value = null;
    }, 3000);
  }
}

// Trigger reloading when modal is opened
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadSummaryData();
  }
});
</script>

<template>
  <div 
    v-if="isOpen" 
    id="reminder-courier-modal-backdrop"
    class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
  >
    <div class="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 animate-pulse">
            <Bell class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-xs font-extrabold text-slate-900 tracking-tight border-none">Reminder Courier Summary</h3>
            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Metrik Status Operasional Kurir STD & Sameday</p>
          </div>
        </div>
        <button 
          type="button" 
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors" 
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Scrollable Message Body content -->
      <div class="p-5 overflow-y-auto space-y-5">
        <!-- Floating State Notification messages -->
        <div 
          v-if="successMessage" 
          class="p-3 bg-green-50/90 border border-green-200 rounded-lg text-xs font-semibold text-green-800 flex items-center gap-2 shadow-2xs"
        >
          <CheckCircle2 class="w-4 h-4 text-green-600 shrink-0" />
          <span>{{ successMessage }}</span>
        </div>
        
        <div 
          v-if="errorMessage" 
          class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800 flex items-center gap-2 shadow-2xs"
        >
          <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Optional filter configuration checkbox -->
        <div class="bg-slate-50 border border-slate-150 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-3xs">
          <div class="flex items-center gap-2">
            <Filter class="w-4 h-4 text-slate-400 shrink-0" />
            <span class="text-2xs font-bold text-slate-500 uppercase tracking-wider">PILIHAN FILTER REMINDER</span>
          </div>
          <label class="inline-flex items-center gap-2 cursor-pointer select-none">
            <input 
              v-model="filterOnlyActive" 
              type="checkbox" 
              class="w-4 h-4 text-emerald-600 border-slate-300 rounded-md focus:ring-emerald-500 cursor-pointer" 
            />
            <span class="text-xs font-semibold text-slate-700">Tampilkan hanya courier yang masih memiliki Delivering > 0</span>
          </label>
        </div>

        <!-- Analytical KPI cards grid with dynamic calculations -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
            <span class="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Total Courier</span>
            <span class="text-sm text-slate-800 font-extrabold block mt-1">{{ computedTotalCourier }}</span>
          </div>
          
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
            <span class="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Total AWB</span>
            <span class="text-sm text-slate-800 font-extrabold block mt-1 text-purple-600">{{ computedTotalAwb }}</span>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
            <span class="text-[8px] text-blue-500 font-bold uppercase tracking-wider block">Delivering</span>
            <span class="text-sm text-blue-600 font-extrabold block mt-1">{{ computedTotalDelivering }}</span>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center flex flex-col justify-between">
            <span class="text-[8px] text-amber-500 font-bold uppercase tracking-wider block">On Hold</span>
            <span class="text-sm text-amber-600 font-extrabold block mt-1">{{ computedTotalOnHold }}</span>
          </div>

          <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-2.5 text-center col-span-2 sm:col-span-1 flex flex-col justify-between">
            <span class="text-[8px] text-emerald-600 font-bold uppercase tracking-wider block">Delivered</span>
            <span class="text-sm text-emerald-600 font-extrabold block mt-1">{{ computedTotalDelivered }}</span>
          </div>
        </div>

        <!-- Unified Layout (Split Side-by-Side: Table and WP Text Preview) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- Summary Table (7 Cols) -->
          <div class="lg:col-span-7 border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white">
            <div class="bg-slate-50 border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between">
              <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tabel Summary Kinerja Kurir</span>
              <span v-if="isLoading" class="text-2xs text-blue-600 font-bold flex items-center gap-1">
                <Loader2 class="w-3.5 h-3.5 animate-spin" /> Mengambil data...
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-[11px]">
                <thead class="bg-slate-50 text-slate-400 uppercase font-black text-[8px] border-b border-slate-1.5 md:tracking-wider">
                  <tr>
                    <th class="px-3.5 py-2 font-bold">Driver</th>
                    <th class="px-2 py-2 font-bold text-center">Total AWB</th>
                    <th class="px-2 py-2 font-bold text-center text-blue-600">DELIV</th>
                    <th class="px-2 py-2 font-bold text-center text-amber-600">HOLD</th>
                    <th class="px-2 py-2 font-bold text-center text-emerald-600">SUCCESS</th>
                    <th class="px-3 py-2 font-bold text-right text-purple-600">% SUCCESS</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-700">
                  <tr v-if="processedDrivers.length === 0 && !isLoading">
                    <td colspan="6" class="px-4 py-12 text-center text-slate-400 font-semibold italic">
                      Belum ada data kurir yang sesuai filter.
                    </td>
                  </tr>
                  <tr 
                    v-for="(row, idx) in processedDrivers" 
                    :key="idx"
                    class="hover:bg-slate-50/50 transition-colors"
                  >
                    <td class="px-3.5 py-2 font-bold text-slate-800">{{ row.driver }}</td>
                    <td class="px-2 py-2 text-center font-bold text-slate-600">{{ row.total_awb }}</td>
                    <td class="px-2 py-2 text-center font-bold text-blue-600">{{ row.delivering }}</td>
                    <td class="px-2 py-2 text-center font-bold text-amber-600">{{ row.on_hold }}</td>
                    <td class="px-2 py-2 text-center font-bold text-emerald-600">{{ row.delivered }}</td>
                    <td class="px-3 py-2 text-right font-black text-purple-600">{{ row.pct_delivered.toFixed(1) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- WhatsApp Text Template Live Preview Area (5 Cols) -->
          <div class="lg:col-span-5 flex flex-col space-y-1.5 bg-white border border-slate-200 rounded-xl p-3.5 h-[340px] shadow-3xs">
            <div class="flex items-center justify-between border-b border-slate-100 pb-2">
              <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Preview WhatsApp Message</span>
              <span class="text-[9px] text-emerald-600 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">LIVE TEMPLATE</span>
            </div>
            <textarea 
              readonly 
              class="w-full flex-1 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] font-mono leading-relaxed text-slate-700 resize-none outline-none focus:ring-1 focus:ring-emerald-500"
              :value="whatsappMessageBody"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Action Modal Footer buttons -->
      <div class="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/40">
        <!-- Generated timestamp detail -->
        <span class="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
          <Calendar class="w-3.5 h-3.5 text-slate-300" />
          Update: {{ generatedAt }}
        </span>

        <div class="flex items-center gap-2">
          <button 
            id="btn-close-reminder"
            type="button" 
            class="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition select-none outline-none"
            @click="emit('close')"
          >
            Close
          </button>
          
          <button 
            id="btn-export-excel-reminder"
            type="button" 
            class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer transition select-none disabled:opacity-40"
            :disabled="isExporting || isLoading || processedDrivers.length === 0"
            @click="exportSummaryToExcel"
          >
            <Download class="w-3.5 h-3.5" v-if="!isExporting" />
            <Loader2 class="w-3.5 h-3.5 animate-spin" v-else />
            Export Excel
          </button>

          <button 
            id="btn-whatsapp-reminder"
            type="button" 
            class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-md cursor-pointer select-none disabled:bg-slate-300"
            :disabled="isCopying || isLoading || processedDrivers.length === 0"
            @click="copyWhatsAppReminder"
          >
            <Copy class="w-3.5 h-3.5" v-if="!isCopying" />
            <Loader2 class="w-3.5 h-3.5 animate-spin" v-else />
            Copy WhatsApp Reminder
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.18s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>
