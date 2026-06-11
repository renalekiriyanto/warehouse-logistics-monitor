<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useLogisticsStore } from '../../store/logisticsStore';
import { parseCSV } from '../../utils/csvParser';
import stdSomedayService, { StdSomedayData } from '../../services/stdSomedayService';
import DataPreviewTable from '../DataPreviewTable.vue';
import ReminderSummaryModal from '../ReminderSummaryModal.vue';
import * as XLSX from 'xlsx';
import { 
  TableProperties, Server, RefreshCw, CheckCircle2, AlertCircle, 
  CalendarDays, Bell, X, AlertTriangle, Loader2, UploadCloud, 
  FileSpreadsheet, Trash2, Database, Clock, ArrowUpRight, Activity, 
  FileText, Check, FileDown
} from 'lucide-vue-next';

const store = useLogisticsStore();

// Inline drag & drop states
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const fileInputCsv = ref<HTMLInputElement | null>(null);
const fileInputExcel = ref<HTMLInputElement | null>(null);
const localUploadError = ref<string | null>(null);
const isLocalProcessing = ref(false);

// Navigation and Notification States
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
  notification.value = { message, type };
  setTimeout(() => {
    notification.value = null;
  }, 4500);
}

// State Management
const isLoadingData = ref(false);

const apiError = ref<string | null>(null);
const apiSuccess = ref(false);
const lastFetchTime = ref<string | null>(null);

// Date Filtering States
const filterStartDate = ref('');
const filterEndDate = ref('');

// Step 1 File Upload Selection Details
const fileDetails = ref<{ name: string; size: string; rows: number } | null>(null);
const fileParsingError = ref<string | null>(null);
const parsedPreviewRows = ref<any[]>([]);

// Real-time Import Progress states (specifically matching user requirements)
const selectedFile = ref<File | null>(null);
const uploadProgress = ref(0);
const importStatus = ref<'uploading' | 'queued' | 'processing' | 'completed' | 'failed' | null>(null);
const importProgress = ref(0);
const processedRows = ref(0);
const totalRows = ref(0);
const successRows = ref(0);
const failedRows = ref(0);
const importUuid = ref<string | null>(null);
const isUploading = ref(false);
const isPolling = ref(false);
const showProgressModal = ref(false);
const isReminderModalOpen = ref(false);

// Internal timer and support states
const pollInterval = ref<any>(null);
const statusMessage = ref('Menghubungkan ke server...');
const duration = ref(0);
const batchErrors = ref<any[]>([]);
const importStartTime = ref<number | null>(null);

// Get All STD/Sameday deliveries
async function fetchStdsApi() {
  isLoadingData.value = true;
  apiError.value = null;
  apiSuccess.value = false;
  try {
    const params: any = {};
    if (filterStartDate.value) {
      params.start_date = filterStartDate.value;
      params.start = filterStartDate.value;
    }
    if (filterEndDate.value) {
      params.end_date = filterEndDate.value;
      params.end = filterEndDate.value;
    }

    const rawItems = await stdSomedayService.getAll(params);
    
    // Map Laravel DB properties safely to match both the UI grid columns and Pinia store state schema
    if (rawItems && rawItems.length > 0) {
      const mappedItems = rawItems.map((item: any) => {
        // Safe fallback for date and time fields
        const dateVal = item.date || (item.date_time && item.date_time.includes(' ') ? item.date_time.split(' ')[0] : (item.date_time && item.date_time.includes('T') ? item.date_time.split('T')[0] : '2026-05-30'));
        const timeVal = item.time || (item.date_time && item.date_time.includes(' ') ? item.date_time.split(' ')[1] : '00:00');
        
        const driverName = item.driver_name || item.courier || 'N/A';
        const driverId = item.driver_id ?? item.id_driver ?? '-';
        
        return {
          // Pinia Store backwards-compatibility properties
          resi: item.awb || item.resi || `RESI-STD-${item.id}`,
          courier: driverName,
          target: 1,
          completed: ['completed', 'delivered'].includes(String(item.status).toLowerCase()) ? 1 : 0,
          pending: !['completed', 'delivered'].includes(String(item.status).toLowerCase()) ? 1 : 0,
          status: item.status || 'pending',
          date: dateVal,
          time: timeVal,

          // Custom Target database properties
          id: item.id,
          date_time: item.date_time || `${dateVal} ${timeVal}`,
          date: dateVal,
          time: timeVal,
          awb: item.awb || item.resi || '-',
          driver_id: driverId,
          driver_name: driverName,
          id_driver: driverId,
        };
      });

      store.importData('std', mappedItems);
      apiSuccess.value = true;
      lastFetchTime.value = new Date().toLocaleTimeString('id-ID');
    } else {
      store.importData('std', []); // reset/kosongkan store jika perlu
      apiSuccess.value = true;     // tetap success, hanya datanya memang kosong
      showNotification('Data tidak ditemukan untuk filter yang dipilih.', 'info');
    }
  } catch (err: any) {
    console.error('STD API Fetch failed:', err);
    apiError.value = err.message || 'Koneksi ditolak oleh API FMS lokal (Server Offline atau CORS) di port 8000.';
    showNotification('Gagal mengambil data dari API Laravel.', 'error');
  } finally {
    isLoadingData.value = false;
  }
}

// Convert input excel or CSV Date & Time format helper
function parseDateAndTime(dateStr: string, timeStr: string): string {
  if (!dateStr) return '';
  
  let formattedDate = '';
  const cleanDate = dateStr.trim();
  const dParts = cleanDate.split(/[-/]/);
  
  if (dParts.length === 3) {
    if (dParts[0].length === 4) {
      const y = dParts[0];
      const m = dParts[1].padStart(2, '0');
      const d = dParts[2].padStart(2, '0');
      formattedDate = `${y}-${m}-${d}`;
    } else {
      // Typically D/M/YYYY or DD/MM/YYYY
      let d = dParts[0].padStart(2, '0');
      let m = dParts[1].padStart(2, '0');
      let y = dParts[2];
      if (y.length === 2) {
        y = '20' + y;
      }
      formattedDate = `${y}-${m}-${d}`;
    }
  } else {
    try {
      const dObj = new Date(cleanDate);
      if (!isNaN(dObj.getTime())) {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const day = String(dObj.getDate()).padStart(2, '0');
        formattedDate = `${y}-${m}-${day}`;
      }
    } catch(e) {}
  }

  let formattedTime = '00:00:00';
  if (timeStr) {
    const cleanTime = timeStr.trim().toUpperCase();
    const isAmPm = cleanTime.includes('AM') || cleanTime.includes('PM');
    const digitsOnly = cleanTime.replace(/[AP]M/, '').trim();
    const timeParts = digitsOnly.split(':');
    
    if (timeParts.length >= 2) {
      let h = parseInt(timeParts[0], 10);
      const m = parseInt(timeParts[1], 10);
      const s = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
      
      if (isAmPm) {
        if (cleanTime.includes('PM') && h < 12) {
          h += 12;
        } else if (cleanTime.includes('AM') && h === 12) {
          h = 0;
        }
      }
      
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const ss = String(s).padStart(2, '0');
      formattedTime = `${hh}:${mm}:${ss}`;
    }
  }

  return `${formattedDate} ${formattedTime}`.trim();
}

/**
 * Inline File Processing and Drag Events
 */
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
  localUploadError.value = null;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    processSelectedFile(files[0]);
  }
}

function triggerSelectFile(type?: 'csv' | 'excel' | 'all') {
  if (type === 'csv') {
    fileInputCsv.value?.click();
  } else if (type === 'excel') {
    fileInputExcel.value?.click();
  } else {
    fileInput.value?.click();
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    processSelectedFile(files[0]);
  }
}

function processSelectedFile(file: File) {
  fileParsingError.value = null;
  localUploadError.value = null;
  parsedPreviewRows.value = [];
  fileDetails.value = null;
  selectedFile.value = null;

  // Reset seluruh state import agar tidak campur dengan import sebelumnya
  batchErrors.value = [];
  successRows.value = 0;
  failedRows.value = 0;
  processedRows.value = 0;
  totalRows.value = 0;
  importStatus.value = null;
  importProgress.value = 0;
  uploadProgress.value = 0;
  duration.value = 0;

  const suffix = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (suffix !== '.csv' && suffix !== '.txt' && suffix !== '.xlsx' && suffix !== '.xls') {
    fileParsingError.value = 'Hanya menerima berkas format CSV (.csv, .txt) atau Excel (.xlsx, .xls) saja.';
    showNotification(fileParsingError.value, 'error');
    return;
  }

  selectedFile.value = file;
  const sizeInKB = (file.size / 1024).toFixed(1) + ' KB';
  isLocalProcessing.value = true;

  if (suffix === '.xlsx' || suffix === '.xls') {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        
        parseLoadedCsvText(csvText, file.name, sizeInKB);
      } catch (err: any) {
        fileParsingError.value = 'Gagal memproses berkas Excel: ' + err.message;
        showNotification(fileParsingError.value, 'error');
      } finally {
        isLocalProcessing.value = false;
      }
    };
    reader.onerror = () => {
      fileParsingError.value = 'Gagal membaca isi konten file Excel.';
      showNotification(fileParsingError.value, 'error');
      isLocalProcessing.value = false;
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseLoadedCsvText(text, file.name, sizeInKB);
      isLocalProcessing.value = false;
    };
    reader.onerror = () => {
      fileParsingError.value = 'Gagal membaca isi konten file.';
      showNotification(fileParsingError.value, 'error');
      isLocalProcessing.value = false;
    };
    reader.readAsText(file);
  }
}

function parseLoadedCsvText(text: string, fileName: string, sizeDisplay: string) {
  try {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const rowCount = lines.length > 1 ? lines.length - 1 : 0;

    fileDetails.value = {
      name: fileName,
      size: sizeDisplay,
      rows: rowCount
    };

    const parsedData = parseCSV(text, 'std');
    parsedPreviewRows.value = parsedData.items.slice(0, 5).map((item: any, idx: number) => {
      const rowDate = item.Date || item.date || '2026-05-30';
      const rowTime = item.Time || item.time || '12:00:00';
      const fullDateTime = parseDateAndTime(rowDate, rowTime);

      return {
        id: idx + 1,
        date_time: fullDateTime,
        awb: item.AWB || item.awb || item.resi || `AWB-PREV-${idx}`,
        id_driver: item['ID Driver'] || item.id_driver || item.courier || '-',
        driver_name: item['Driver Name'] || item.driver_name || '-',
        status: item.Status || item.status || 'pending'
      };
    });
  } catch (err: any) {
    fileParsingError.value = 'Gagal memetakan draf preview kargo: ' + err.message;
    console.warn(err);
  }
}

/**
 * Handle incoming file parsed event from internal file loader component
 */
function handleFileSelected(event: { text: string; fileName: string; file?: File }) {
  if (event.file) {
    processSelectedFile(event.file);
  } else {
    const sizeMock = 'N/A KB';
    parseLoadedCsvText(event.text, event.fileName, sizeMock);
  }
}

/**
 * Real-time active batch job polling
 */
/**
 * Real-time active batch job polling
 */
const startPolling = (uuid: string) => {
  // Clear any existing polling interval to prevent memory leaks
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
  }

  isPolling.value = true;
  importUuid.value = uuid;

  pollInterval.value = setInterval(async () => {
    try {
      // Live calculate duration in seconds
      if (importStartTime.value) {
        duration.value = Math.round((Date.now() - importStartTime.value) / 1000);
      }

      const response = await stdSomedayService.getImportStatus(uuid);
      // Cleanly retrieve the data wrapper from the getImportStatus model response
      const batch = response.data;
      if (!batch) {
        throw new Error('Sistem gagal memparsing respon progress import dari server.');
      }

      // TEMPORARY DEBUGGING LOG as requested by user
      console.log(
        'IMPORT STATUS RESPONSE (Polling Progress)',
        response.data
      );

      importStatus.value = batch.status;
      importProgress.value = batch.progress ?? 0;
      processedRows.value = batch.processed_rows ?? 0;
      totalRows.value = batch.total_rows ?? 0;
      
      // Calculate success and failed rows according to backend schema fields
      successRows.value = batch.success_rows ?? batch.success_count ?? 0;
      failedRows.value = typeof batch.failed_rows === 'number' ? batch.failed_rows : (Array.isArray(batch.failed_rows) ? batch.failed_rows.length : (batch.failed_count ?? 0));

      // Parse and normalize errors if present
      // Support errors, validation_errors, failed_items, error_rows, and array-formatted failed_rows
      const rawErrors = batch.errors || batch.validation_errors || batch.failed_items || batch.error_rows || (Array.isArray(batch.failed_rows) ? batch.failed_rows : []);
      const normalizedErrors: any[] = [];
      if (Array.isArray(rawErrors)) {
        rawErrors.forEach((err: any) => {
          if (typeof err === 'string') {
            normalizedErrors.push({
              row: '-',
              awb: '-',
              message: err
            });
          } else if (err && typeof err === 'object') {
            normalizedErrors.push({
              row: err.row || err.line || err.index || '-',
              awb: err.awb || err.resi || err.barcode || '-',
              message: err.message || err.error || err.reason || JSON.stringify(err)
            });
          }
        });
      } else if (rawErrors && typeof rawErrors === 'object') {
        Object.entries(rawErrors).forEach(([key, val]: [string, any]) => {
          if (Array.isArray(val)) {
            val.forEach(item => {
              normalizedErrors.push({
                row: key,
                awb: '-',
                message: String(item)
              });
            });
          } else {
            normalizedErrors.push({
              row: key,
              awb: '-',
              message: String(val)
            });
          }
        });
      }
      batchErrors.value = normalizedErrors;

      // Ensure failedRowsCount is also synced if we have parsed errors
      if (batchErrors.value.length > 0 && failedRows.value === 0) {
        failedRows.value = batchErrors.value.length;
      }

      // Handle custom text status updates for user friendly indicators
      if (batch.status === 'queued') {
        statusMessage.value = 'Menunggu antrean import...';
      } else if (batch.status === 'processing') {
        statusMessage.value = 'Sedang memproses data...';
      } else if (batch.status === 'completed') {
        statusMessage.value = 'Import selesai';
        showNotification(`Selesai memproses ${successRows.value} data dengan sukses.`, 'success');
        
        // TEMPORARY DEBUGGING LOG as requested by user
        console.log(
          'IMPORT STATUS RESPONSE (Completed State)',
          response.data
        );

        clearInterval(pollInterval.value);
        pollInterval.value = null;
        isPolling.value = false;

        // Auto reload table data in background, but keep the modal open
        await fetchStdsApi();

      } else if (batch.status === 'failed') {
        statusMessage.value = batch.message || 'Import gagal';
        showNotification('Proses import gagal atau dibatalkan di server.', 'error');
        
        // TEMPORARY DEBUGGING LOG as requested by user
        console.log(
          'IMPORT STATUS RESPONSE (Failed State)',
          response.data
        );

        clearInterval(pollInterval.value);
        pollInterval.value = null;
        isPolling.value = false;
      }
    } catch (e: any) {
      console.warn('Gagal membaca progress status dari server:', e);
    }
  }, 2000);
};

/**
 * CORE STEP 2: TRIGGER UPLOAD WITH PROGRESS MODAL
 */
async function onStartUpload() {
  if (!selectedFile.value) {
    showNotification('Silakan pilih berkas Excel/CSV kargo terlebih dahulu', 'error');
    return;
  }

  showProgressModal.value = true;
  importStatus.value = 'uploading';
  statusMessage.value = 'Uploading file...';
  uploadProgress.value = 1;
  importProgress.value = 0;
  processedRows.value = 0;
  successRows.value = 0;
  failedRows.value = 0;
  totalRows.value = fileDetails.value?.rows || 0;
  isUploading.value = true;
  isPolling.value = false;
  batchErrors.value = [];
  importStartTime.value = Date.now();
  duration.value = 0;

  try {
    // Post Multi-part form data to Laravel API with upload progress callback
    const uploadResult = await stdSomedayService.upload(selectedFile.value, (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        uploadProgress.value = Math.max(1, percent);
      }
    });

    // TEMPORARY DEBUGGING LOG as requested by user
    console.log(
      'IMPORT STATUS RESPONSE (Upload Selesai)',
      uploadResult.data
    );

    // STEP 3: SUCCESSFUL UPLOAD TRANSITION
    statusMessage.value = '✓ File uploaded successfully';
    uploadProgress.value = 100;
    isUploading.value = false;

    // Get UUID from the response
    const uuid = uploadResult.data?.uuid;
    if (!uuid) {
      throw new Error('Gagal menerima token UUID untuk pelacakan import.');
    }

    importUuid.value = uuid;

    // Wait a brief moment then trigger polling
    setTimeout(() => {
      startPolling(uuid);
    }, 1000);

  } catch (err: any) {
    console.error('Import failed:', err);
    importStatus.value = 'failed';
    isUploading.value = false;
    isPolling.value = false;
    if (pollInterval.value) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
    }
    statusMessage.value = err.response?.data?.message || err.message || 'Gagal sewaktu mengunggah file kargo ke server.';
    showNotification('Proses upload kargo dibatalkan.', 'error');
  }
}

/**
 * Clean up active polling interval when component is destroyed
 */
onUnmounted(() => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
});

/**
 * Handle discarding draft
 */
function discardDraft() {
  selectedFile.value = null;
  fileDetails.value = null;
  fileParsingError.value = null;
  parsedPreviewRows.value = [];
}

/**
 * Clear or reset database table on REST API
 */
async function onClearData() {
  if (!confirm('Apakah Anda yakin ingin menghapus seluruh data harian STD/Sameday dari server Laravel?')) {
    return;
  }

  isLoadingData.value = true;
  apiSuccess.value = false;
  apiError.value = null;
  try {
    await stdSomedayService.reset();
    showNotification('Berhasil mengosongkan seluruh data STD/Sameday dari server.', 'success');
    store.clearData('std');
    await fetchStdsApi();
  } catch (err: any) {
    console.error('Reset error:', err);
    showNotification(err.message || 'Gagal mengosongkan database.', 'error');
    // Local fallback clear
    store.clearData('std');
  } finally {
    isLoadingData.value = false;
  }
}

// Normalize different date formats to comparable standard YYYY-MM-DD for visual filtering
function normalizeDateOnly(dateValue: any): string {
  if (!dateValue) return '';
  const dateStr = String(dateValue).trim();
  
  if (dateStr.includes('T')) return dateStr.split('T')[0];
  if (dateStr.includes(' ')) return dateStr.split(' ')[0];
  
  const euDateMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (euDateMatch) {
    const day = euDateMatch[1].padStart(2, '0');
    const month = euDateMatch[2].padStart(2, '0');
    const year = euDateMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  const usDateMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (usDateMatch) {
    const year = usDateMatch[1];
    const month = usDateMatch[2].padStart(2, '0');
    const day = usDateMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch (e) {}

  return dateStr;
}

// Date Filter watch & fetch logic
let debounceTimer: any = null;
watch([filterStartDate, filterEndDate], () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetchStdsApi();
  }, 400);
});

const filteredStds = computed(() => store.std);

function clearDateFilter() {
  filterStartDate.value = '';
  filterEndDate.value = '';
}

// Columns Schema mapped for target database: id, date, time, awb, driver_id, driver_name, status
const columns = [
  { key: 'date', label: 'Tanggal (date)', type: 'string' },
  { key: 'time', label: 'Jam (time)', type: 'string' },
  { key: 'awb', label: 'No. AWB (awb)', type: 'string' },
  { key: 'driver_name', label: 'Nama Driver (driver_name)', type: 'string' },
  { key: 'status', label: 'Status Pengiriman', type: 'status' }
];

onMounted(() => {
  fetchStdsApi();
});
</script>

<template>
  <div id="std-someday-delivered-container" class="space-y-6">
    <!-- Floating Notification Info -->
    <div 
      v-if="notification" 
      class="fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-xl border text-xs max-w-sm flex items-center gap-2.5 animate-fade-in transition-all"
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

    <!-- Active REST API Integration Status bar -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Server class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-slate-900 border-none">Integrasi API Laporan STD/Sameday Delivered</h3>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border"
                :class="apiError ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'"
              >
                {{ apiError ? 'API Offline (Local Storage)' : 'API Connected' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 max-w-xl leading-relaxed mt-1">
              Data ditarik secara dinamis dari <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">GET /api/std-somedays</code>. 
              Gunakan panel di bawah ini untuk mengunggah CSV & Excel secara biner ke server Laravel.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            id="btn-clear-database-someday"
            type="button" 
            class="flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg shadow-sm transition cursor-pointer select-none"
            :disabled="isLoadingData"
            @click="onClearData"
          >
            <Trash2 class="w-3.5 h-3.5" />
            Reset Data
          </button>

          <button 
            id="btn-sync-std-someday"
            type="button" 
            class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer disabled:opacity-50 select-none shrink-0"
            :disabled="isLoadingData"
            @click="fetchStdsApi"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{'animate-spin': isLoadingData}" />
            {{ isLoadingData ? 'Sinkronkan...' : 'Refresh Data' }}
          </button>

          <button 
            id="btn-export-reminder"
            type="button" 
            class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer select-none shrink-0"
            @click="isReminderModalOpen = true"
          >
            <Bell class="w-3.5 h-3.5" />
            Export Reminder
          </button>
        </div>
      </div>

      <!-- Live Connection Alert Feedback -->
      <div v-if="apiSuccess" class="p-3 bg-green-55/40 border border-green-100 rounded-lg flex items-start gap-2.5">
        <CheckCircle2 class="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
        <div class="text-xs text-slate-700 space-y-0.5 leading-relaxed">
          <p class="font-bold text-green-800">Sinkronisasi Database Berhasil</p>
          <p>Terhubung ke database internal harian STD/Sameday pada jam <b>{{ lastFetchTime }}</b>.</p>
        </div>
      </div>

      <div v-if="apiError" class="p-3 bg-amber-55/40 border border-amber-100 rounded-lg flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-slate-700 space-y-1">
          <p class="font-bold text-amber-800">REST API Lara-Server Tidak Merespons di http://127.0.0.1:8000</p>
          <p class="text-2xs text-slate-500 leading-relaxed">Pastikan server Laravel beroperasi di port 8000. Untuk kelancaran uji coba, antarmuka front-end tetap memvisualisasikan draf data sementara.</p>
        </div>
      </div>
    </div>

    <!-- CARD 2: MAIN UPLOAD CSV / EXCEL AREA SECTION -->
    <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2 text-sm">
        <div>
          <h3 class="font-bold text-slate-800 flex items-center gap-1.5 leading-none">
            <FileSpreadsheet class="w-4 h-4 text-emerald-600" />
            Metode Sinkronisasi Upload CSV & Excel
          </h3>
          <p class="text-xs text-slate-500 mt-1">Unggah daftar terbaru driver STD/Sameday untuk memantau status operasional secara berkala.</p>
        </div>

        <div class="flex items-center gap-2">
          <button 
            id="btn-select-csv-manual"
            type="button"
            class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer select-none"
            @click="triggerSelectFile('csv')"
          >
            Pilih file CSV
          </button>
          
          <button 
            id="btn-select-excel-manual"
            type="button"
            class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer select-none"
            @click="triggerSelectFile('excel')"
          >
            Pilih file Excel
          </button>
          
          <button 
            v-if="store.std.length > 0"
            id="btn-reset-data-upl"
            type="button"
            class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer select-none"
            @click="onClearData"
          >
            Reset/Kosongkan Data
          </button>
        </div>
      </div>

      <!-- Native Inputs Hidden -->
      <input ref="fileInputCsv" type="file" class="hidden" accept=".csv,.txt" @change="handleFileSelect" />
      <input ref="fileInputExcel" type="file" class="hidden" accept=".xlsx,.xls" @change="handleFileSelect" />
      <input ref="fileInput" type="file" class="hidden" accept=".csv,.txt,.xlsx,.xls" @change="handleFileSelect" />

      <!-- Drag area selection -->
      <div 
        id="drag-drop-container"
        class="border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all cursor-pointer relative font-sans"
        :class="isDragging 
          ? 'border-blue-500 bg-blue-50/40 shadow-inner' 
          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/50'"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        @click="triggerSelectFile('all')"
      >
        <div class="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-500 mx-auto">
          <UploadCloud class="w-6 h-6 text-slate-400" :class="{'animate-pulse': isDragging}" />
        </div>

        <div v-if="isLocalProcessing" class="space-y-1.5">
          <p class="text-sm font-semibold text-blue-600 flex items-center gap-2 justify-center">
            <RefreshCw class="w-4 h-4 animate-spin" />
            Memproses Berkas...
          </p>
        </div>
        
        <div v-else class="space-y-1">
          <p class="text-sm font-semibold text-slate-700">Drag & Drop berkas CSV / Excel atau <span class="text-blue-600 hover:underline">klik untuk memilih file</span></p>
          <p class="text-xs text-slate-500">Menerima format CSV (.csv, .txt) atau Excel (.xlsx, .xls)</p>
        </div>
      </div>

      <!-- Row for displaying parsing errors if any -->
      <div 
        v-if="fileParsingError" 
        id="local-file-parse-error" 
        class="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2"
      >
        <AlertCircle class="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <span>{{ fileParsingError }}</span>
      </div>

      <!-- Preview of Mapped Selected File Details -->
      <div v-if="fileDetails" class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div class="md:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between">
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-blue-600">
              <FileSpreadsheet class="w-5 h-5 shrink-0" />
              <span class="text-xs font-extrabold uppercase tracking-wider">Berkas Terpilih (Kargo)</span>
            </div>

            <div class="space-y-2 text-xs">
              <div>
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Nama File</span>
                <span class="font-bold text-slate-800 break-all leading-tight mt-0.5 block font-mono pr-2">{{ fileDetails.name }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase">Ukuran</span>
                  <span class="font-bold text-slate-800 block mt-0.5 text-xs">{{ fileDetails.size }}</span>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase">Total Data</span>
                  <span class="font-bold text-slate-800 block mt-0.5 text-xs">{{ fileDetails.rows }} baris</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-3 border-t border-slate-200/60">
            <button 
              type="button" 
              class="flex-1 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition text-center select-none"
              @click="discardDraft"
            >
              Batal
            </button>
            <button 
              id="btn-confirm-binary-upload"
              type="button" 
              class="flex-2 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-md cursor-pointer select-none"
              @click="onStartUpload"
            >
              <UploadCloud class="w-4 h-4" />
              Upload dan Proses
            </button>
          </div>
        </div>

        <!-- Columns Target Mapping Table layout -->
        <div class="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-slate-500 uppercase pb-2 border-b border-slate-200/60 mb-2 font-bold tracking-wider text-[10px]">
              <span>Draf Kolom Target / Mapping</span>
              <span class="text-blue-600 font-bold uppercase tracking-widest text-[9px]">Preview Teratas (Top 5 Rows)</span>
            </div>
            
            <div class="space-y-2 max-h-32 overflow-y-auto pr-1">
              <div 
                v-for="(row, idx) in parsedPreviewRows" 
                :key="idx"
                class="bg-white border border-slate-150 rounded-lg p-2.5 text-xs space-y-1 block shadow-3xs"
              >
                <div class="flex items-center justify-between font-mono text-slate-600 text-[10px]">
                  <span class="text-slate-800 font-bold">Resi/AWB: {{ row.awb }}</span>
                  <span>Driver: {{ row.driver_name }}</span>
                </div>
                <div class="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Waktu: {{ row.date_time }}</span>
                  <span class="px-1.5 py-0.5 text-3xs font-extrabold uppercase rounded bg-blue-50 border border-blue-100 text-blue-700 font-mono">
                    {{ row.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <Activity class="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Seluruh data Driver (ID & Nama), Tanggal, Jam, No AWB, dan Status disimpan secara dinamis ke database backend.</span>
          </div>
        </div>
      </div>

      <!-- Active processing metrics inside the card too for complete live visibility -->
      <div v-else class="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-4">
        <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto">
          <Database class="w-5 h-5" />
        </div>
        <div class="text-xs max-w-md mx-auto space-y-3">
          <h4 class="font-extrabold text-slate-800 uppercase tracking-wider">Metode Deteksi Format Otomatis</h4>
          
          <div class="bg-white border border-slate-150 rounded-lg p-4 text-left space-y-2.5 shadow-3xs">
            <p class="font-bold text-slate-700">Format yang didukung:</p>
            <div class="space-y-1.5 text-slate-600 font-medium">
              <div class="flex items-center gap-2 text-emerald-600">
                <span class="font-bold text-sm">✓</span> Legacy STD CSV
              </div>
              <div class="flex items-center gap-2 text-emerald-600">
                <span class="font-bold text-sm">✓</span> Shopee Direct CSV
              </div>
            </div>
          </div>
          
          <p class="text-slate-500 leading-relaxed">
            Sistem akan mendeteksi format file secara otomatis.<br/>
            Tidak diperlukan proses edit atau mapping Excel sebelum upload.
          </p>
        </div>
      </div>
    </div>

    <!-- Date filtering and Query Range Selector -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex items-center gap-2">
        <CalendarDays class="w-4 h-4 text-blue-600" />
        <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Filter Range Tanggal Pengiriman (date_time)</h4>
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
          class="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-250 cursor-pointer h-9 transition-all select-none"
          @click="clearDateFilter"
        >
          Reset Filter Tanggal
        </button>
      </div>
    </div>

    <!-- DATABASE DETAILS PREVIEW TABLE -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <TableProperties class="w-4 h-4 text-blue-600" />
          Preview Database Laporan Harian STD/Sameday (Total: {{ filteredStds.length }})
        </h3>
        <span class="text-2xs font-semibold text-slate-400 font-mono flex items-center gap-1">
          <Activity class="w-3.5 h-3.5 text-blue-500" />
          Laravel Target: Table 'std_somedays'
        </span>
      </div>

      <!-- SKELETON LOADER FEEDBACK -->
      <div v-if="isLoadingData" class="border border-slate-100 bg-white rounded-xl p-6.5 space-y-4 shadow-3xs animate-pulse">
        <div class="flex items-center justify-between gap-4">
          <div class="h-8 bg-slate-100 rounded-lg w-1/3"></div>
          <div class="h-8 bg-slate-100 rounded-lg w-20"></div>
        </div>
        <div class="space-y-2">
          <div v-for="i in 5" :key="i" class="grid grid-cols-4 gap-4 h-5 bg-slate-50 border-b border-slate-50 py-1 rounded">
            <div class="bg-slate-100 h-3 rounded col-span-1"></div>
            <div class="bg-slate-100 h-3 rounded col-span-1"></div>
            <div class="bg-slate-100 h-3 rounded col-span-1"></div>
            <div class="bg-slate-100 h-3 rounded col-span-1"></div>
          </div>
        </div>
      </div>

      <!-- DATA VIEWPORT TABLE -->
      <DataPreviewTable 
        v-else
        :items="filteredStds"
        :columns="columns"
      />
    </div>    <!-- STEP 2 - 6: IMPORT PROGRESS MODAL (PORTAL DIALOG) -->
    <div 
      v-if="showProgressModal" 
      id="import-progress-modal-backdrop"
      class="fixed inset-0 bg-slate-900/60 backdrop-blur-3xs flex items-center justify-center p-4 z-50 animate-fade-in"
    >
      <div id="import-progress-modal" class="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-scale-up transition-all duration-300">
        <!-- Modal Heading Header -->
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <RefreshCw class="w-4 h-4 animate-spin" v-if="['uploading', 'queued', 'processing'].includes(importStatus || '')" />
              <Check class="w-4 h-4 text-emerald-600" v-else-if="importStatus === 'completed'" />
              <AlertTriangle class="w-4 h-4 text-rose-500" v-else />
            </div>
            <div>
              <h3 class="text-xs font-bold text-slate-900 border-none">Proses Import Data Laravel</h3>
              <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Standard/Sameday Real-Time Monitor</p>
            </div>
          </div>
          <button 
            type="button" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors" 
            :disabled="['uploading', 'processing', 'queued'].includes(importStatus || '')"
            @click="showProgressModal = false; discardDraft();"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Progress Modal Elements -->
        <div class="p-6 space-y-5 text-xs">
          <!-- Step Progress Visual Indicator -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="flex items-center gap-2">
              <span 
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                :class="importStatus === 'uploading' ? 'bg-blue-600 text-white' : (['queued','processing','completed'].includes(importStatus || '') ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400')"
              >
                1
              </span>
              <span class="font-bold text-[10px] uppercase tracking-wide" :class="importStatus==='uploading' ? 'text-blue-600' : 'text-slate-500'">Upload</span>
            </div>
            <div class="h-0.5 flex-1 mx-3 bg-slate-150"></div>
            <div class="flex items-center gap-2">
              <span 
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                :class="['queued','processing'].includes(importStatus || '') ? 'bg-blue-600 text-white font-black' : (importStatus==='completed' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400')"
              >
                2
              </span>
              <span class="font-bold text-[10px] uppercase tracking-wide" :class="['queued','processing'].includes(importStatus || '') ? 'text-blue-600' : 'text-slate-400'">Proses</span>
            </div>
            <div class="h-0.5 flex-1 mx-3 bg-slate-150"></div>
            <div class="flex items-center gap-2">
              <span 
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                :class="importStatus === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'"
              >
                3
              </span>
              <span class="font-bold text-[10px] uppercase tracking-wide" :class="importStatus==='completed'?'text-emerald-605 text-emerald-600':'text-slate-400'">Selesai</span>
            </div>
          </div>

          <!-- STATE BANNER ANNOUNCEMENT -->
          <div v-if="importStatus === 'completed'" class="bg-emerald-50 border border-emerald-250/60 rounded-xl p-4 flex items-center gap-3">
            <span class="text-xl">✅</span>
            <div>
              <p class="font-extrabold text-emerald-800 text-[13px]">Import Berhasil</p>
              <p class="text-[10px] text-emerald-600 font-medium">Seluruh baris valid telah selesai disalin ke database Laravel.</p>
            </div>
          </div>

          <div v-else-if="importStatus === 'failed'" class="bg-rose-50 border border-rose-250/60 rounded-xl p-4 flex items-center gap-3 animate-head-shake">
            <span class="text-xl">❌</span>
            <div>
              <p class="font-extrabold text-rose-800 text-[13px]">Import Gagal</p>
              <p class="text-[10px] text-rose-600 font-medium leading-relaxed">{{ statusMessage }}</p>
            </div>
          </div>

          <!-- Progress Bar Realtime (Uploading, Queued & Processing states) -->
          <div v-if="['uploading', 'queued', 'processing'].includes(importStatus || '')" class="space-y-2.5">
            <div class="w-full bg-slate-150 h-2.5 rounded-full overflow-hidden relative border border-slate-200">
              <div 
                class="bg-blue-600 h-full transition-all duration-300 rounded-full"
                :style="{ width: (importStatus === 'processing' ? importProgress : (importStatus === 'queued' ? 0 : uploadProgress)) + '%' }"
              ></div>
            </div>
            
            <!-- Processed Rows Metrics & Percentage -->
            <div class="flex items-center justify-between text-slate-500 font-mono text-[11px] font-bold">
              <span class="uppercase tracking-wider">PROGRESS</span>
              <span class="text-slate-800 font-black">
                {{ processedRows }} / {{ totalRows }} ({{ importStatus === 'processing' ? importProgress : (importStatus === 'queued' ? 0 : uploadProgress) }}%)
              </span>
            </div>
          </div>

          <!-- RINGKASAN IMPORT STATS CARD -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3 font-sans">
            <p class="font-extrabold text-slate-500 text-[10px] tracking-wider uppercase border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Ringkasan Import</span>
              <span class="text-slate-400 font-mono font-normal">TIMED PERFORMANCE</span>
            </p>

            <div class="grid grid-cols-5 gap-2 text-center font-mono font-bold">
              <div class="bg-white border border-slate-150 rounded-lg p-2 col-span-1 min-w-[70px]">
                <span class="text-[8px] text-slate-400 block uppercase">Total Rows</span>
                <span class="text-xs text-slate-800 font-black block mt-0.5">{{ totalRows }}</span>
              </div>
              <div class="bg-white border border-slate-150 rounded-lg p-2 col-span-1 min-w-[70px]">
                <span class="text-[8px] text-slate-400 block uppercase">Processed</span>
                <span class="text-xs text-blue-600 font-black block mt-0.5">{{ processedRows }}</span>
              </div>
              <div class="bg-white border border-slate-150 rounded-lg p-2 col-span-1 min-w-[70px]">
                <span class="text-[8px] text-emerald-600 block uppercase">Success</span>
                <span class="text-xs text-emerald-600 font-black block mt-0.5">{{ successRows }}</span>
              </div>
              <div class="bg-white border border-slate-150 rounded-lg p-2 col-span-1 min-w-[70px]">
                <span class="text-[8px] text-rose-500 block uppercase">Failed</span>
                <span class="text-xs text-rose-500 font-black block mt-0.5">{{ failedRows }}</span>
              </div>
              <div class="bg-white border border-slate-150 rounded-lg p-2 col-span-1 min-w-[70px]">
                <span class="text-[8px] text-amber-600 block uppercase">Duration</span>
                <span class="text-xs text-amber-600 font-black block mt-0.5">{{ duration }}s</span>
              </div>
            </div>
          </div>

          <!-- ERROR DETAIL TABLE (IF SYSTEM HAS VALIDATION ERRORS OR FAILED ROWS DETECTED) -->
          <div v-if="batchErrors.length > 0" class="space-y-2 mt-4">
            <div class="flex items-center justify-between">
              <p class="font-extrabold text-rose-600 text-[10px] flex items-center gap-1.5 uppercase tracking-wide">
                <AlertCircle class="w-3.5 h-3.5" />
                Detail Validasi Error ({{ batchErrors.length }} Baris Skipped)
              </p>
              <span class="text-[9px] text-slate-400 font-mono">Excel/CSV Line Logs</span>
            </div>
            
            <div class="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto shadow-3xs">
              <table class="w-full text-left border-collapse text-[10px]">
                <thead class="bg-slate-50 text-slate-500 font-mono sticky top-0 border-b border-slate-200">
                  <tr>
                    <th class="px-2.5 py-1.5 font-bold w-12 text-center">Row</th>
                    <th class="px-2.5 py-1.5 font-bold w-32 border-l border-slate-200">No. AWB (resi)</th>
                    <th class="px-2.5 py-1.5 font-bold border-l border-slate-200">Penyebab Validasi Error</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-mono text-slate-705 bg-white">
                  <tr v-for="(err, idx) in batchErrors" :key="idx" class="hover:bg-slate-50 transition-colors">
                    <td class="px-2.5 py-1.5 text-center text-slate-500 font-bold border-r border-slate-100">{{ err.row }}</td>
                    <td class="px-2.5 py-1.5 font-extrabold text-blue-600 border-r border-slate-100 break-all select-all">{{ err.awb }}</td>
                    <td class="px-2.5 py-1.5 text-rose-600 font-sans leading-relaxed break-words">{{ err.message }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal Action controller (FOOTER BUTTONS) -->
        <div class="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          <!-- Processing State buttons -->
          <button 
            v-if="['uploading', 'queued', 'processing'].includes(importStatus || '')"
            type="button" 
            class="px-4.5 py-2 text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg select-none disabled:opacity-75 flex items-center gap-1.5 shrink-0"
            disabled
          >
            <Loader2 class="w-3.5 h-3.5 animate-spin" />
            Processing...
          </button>

          <!-- Completed State buttons -->
          <div v-else-if="importStatus === 'completed'" class="flex items-center gap-2">
            <button 
              type="button" 
              class="px-4.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition select-none flex items-center gap-1.5"
              @click="showProgressModal = false; discardDraft();"
            >
              Close
            </button>
            <button 
              type="button" 
              class="px-4.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg cursor-pointer shadow-md select-none flex items-center gap-1.5"
              @click="fetchStdsApi"
              :disabled="isLoadingData"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{'animate-spin': isLoadingData}" />
              Refresh Data
            </button>
          </div>

          <!-- Failed State buttons -->
          <div v-else class="flex items-center gap-2">
            <button 
              type="button" 
              class="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition select-none"
              @click="showProgressModal = false; discardDraft();"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- COURIER REMINDER MODAL -->
  <ReminderSummaryModal 
    :is-open="isReminderModalOpen" 
    @close="isReminderModalOpen = false" 
  />
</template>

<style scoped>
.text-2xs {
  font-size: 0.65rem;
}
</style>
