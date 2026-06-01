<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../utils/api';
import { useLogisticsStore } from '../../store/logisticsStore';
import { parseCSV } from '../../utils/csvParser';
import FileUpload from '../../components/FileUpload.vue';
import DataPreviewTable from '../../components/DataPreviewTable.vue';
import ValidationResult from '../../components/ValidationResult.vue';
import { 
  Server, RefreshCw, CheckCircle2, AlertCircle, 
  Send, TableProperties, AlertTriangle, ListPlus, Clock, Trash2, Loader2,
  Filter, X, Calendar, ChevronDown
} from 'lucide-vue-next';

const store = useLogisticsStore();

// CSV Parser Upload Handling for Inbound
const rawParsedItems = ref<any[]>([]);
const validationErrors = ref<any[]>([]);
const totalParsedRows = ref(0);
const activeUploadedFileName = ref('');
const isAnalyzing = ref(false);
const parsedFileText = ref('');

// Import Progress States
const isImporting = ref(false);
const importProgress = ref(0);
const importStatusText = ref('');
const importSuccessCount = ref(0);
const importErrorMsg = ref<string | null>(null);

function onFileParsed(event: { text: string; fileName: string }) {
  discardDraft();
  isAnalyzing.value = true;
  activeUploadedFileName.value = event.fileName;
  parsedFileText.value = event.text;

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

function processLocalInboundsMapping(cleanItems: any[]) {
  const tempInboundList = cleanItems.map(item => {
    let slotId = item.type_slot || item.id_type_slot || 1;
    if (typeof slotId === 'string' && !isNaN(Number(slotId))) {
      slotId = Number(slotId);
    }

    let foundSlotName = '';
    // Look up friendly slot name if possible
    if (typeof slotId === 'string') {
      const matched = typeSlots.value.find(s => s.name.toLowerCase().includes(slotId.toLowerCase()) || slotId.toLowerCase().includes(s.name.toLowerCase()));
      if (matched) {
        slotId = matched.id;
        foundSlotName = matched.name;
      }
    } else {
      const matched = typeSlots.value.find(s => String(s.id) === String(slotId));
      if (matched) {
        foundSlotName = matched.name;
      }
    }

    return {
      id_type_slot: slotId,
      name: foundSlotName || (typeof slotId === 'string' ? slotId : `Slot ${slotId}`),
      date_inbound: item.date_inbound || getTodayString(),
      actual_arrival: item.actual_arrival || '08:00',
      total_order: Number(item.total_order) || 1
    };
  });
  
  if (tempInboundList.length > 0) {
    apiInboundItems.value = [...tempInboundList, ...apiInboundItems.value];
    localStorage.setItem('logistics_inbounds', JSON.stringify(apiInboundItems.value));
  }
}

function onConfirmImport() {
  const cleanItems = rawParsedItems.value.filter((item) => !item._invalid);
  if (cleanItems.length === 0) {
    showNotification('Tidak ada baris data valid untuk diimpor.', 'error');
    return;
  }

  isImporting.value = true;
  importProgress.value = 0;
  importStatusText.value = 'Mempersiapkan data logistik...';
  importErrorMsg.value = null;

  // Reconstruct a perfectly compliant CSV for the Laravel/FMS backend
  // Headers match exactly: date_inbound,type_slot,actual_arrival,total_order
  const headers = 'date_inbound,type_slot,actual_arrival,total_order';
  const csvLines = cleanItems.map(item => {
    const dateVal = item.date_inbound || getTodayString();
    
    // Check type slot value
    let typeSlotVal = item.type_slot || item.id_type_slot || 1;
    
    // Format actual_arrival to HH:MM:SS (H:i:s in PHP/Laravel)
    let arrivalVal = item.actual_arrival || '08:00:00';
    const parts = arrivalVal.trim().split(':');
    if (parts.length === 2) {
      arrivalVal = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    } else if (parts.length === 3) {
      arrivalVal = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
    }

    const totalOrderVal = Number(item.total_order) || 0;
    return `"${dateVal}","${typeSlotVal}","${arrivalVal}",${totalOrderVal}`;
  });
  
  const reconstructedCsvContent = [headers, ...csvLines].join('\n');

  // Compile a file upload FormData
  const formData = new FormData();
  const csvBlob = new Blob([reconstructedCsvContent], { type: 'text/csv' });
  
  // Keep original file name but ensure it uses a .csv extension to ensure perfect parsing in backend
  let fileNameToUpload = activeUploadedFileName.value || 'inbound_import.csv';
  if (!fileNameToUpload.toLowerCase().endsWith('.csv')) {
    const lastDotIdx = fileNameToUpload.lastIndexOf('.');
    fileNameToUpload = (lastDotIdx !== -1 ? fileNameToUpload.substring(0, lastDotIdx) : fileNameToUpload) + '.csv';
  }
  
  formData.append('file', csvBlob, fileNameToUpload);

  // Set up interval for user feedback during uploading
  let simulatedProgress = 0;
  const progressInterval = setInterval(() => {
    if (simulatedProgress < 95) {
      simulatedProgress += Math.floor(Math.random() * 8) + 2;
      if (simulatedProgress > 95) simulatedProgress = 95;
      
      if (importProgress.value < simulatedProgress) {
        importProgress.value = simulatedProgress;
      }

      if (simulatedProgress < 30) {
        importStatusText.value = `Mengunggah berkas ke server FMS (${importProgress.value}%)...`;
      } else if (simulatedProgress < 65) {
        importStatusText.value = `Server sedang mengurai & memvalidasi ${cleanItems.length} baris inbound (${importProgress.value}%)...`;
      } else {
        importStatusText.value = `Sinkronisasi database pergudangan (${importProgress.value}%)...`;
      }
    }
  }, 100);

  // Make the actual API call to http://127.0.0.1:8000/api/inbounds/upload
  api.post('/inbounds/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (percentCompleted > importProgress.value) {
          importProgress.value = Math.min(percentCompleted, 99);
        }
      }
    }
  }).then(() => {
    clearInterval(progressInterval);
    importProgress.value = 100;
    importStatusText.value = 'Sukses mengupload & mengimpor data ke API Server!';
    importSuccessCount.value = cleanItems.length;

    // Process local store updates
    store.importData('inbound', cleanItems);
    processLocalInboundsMapping(cleanItems);

    showNotification(`Berhasil upload & impor ${cleanItems.length} data Inbound ke API Server.`, 'success');
    
    setTimeout(() => {
      isImporting.value = false;
      discardDraft();
    }, 2000);
  }).catch((err) => {
    clearInterval(progressInterval);
    console.warn('API http://127.0.0.1:8000/api/inbounds/upload offline atau bermasalah:', err.message);

    // If local API offline, run local fallback with realistic tick progress
    let fallbackTick = importProgress.value;
    const fallbackTimer = setInterval(() => {
      if (fallbackTick < 100) {
        fallbackTick += 8;
        if (fallbackTick >= 100) {
          fallbackTick = 100;
          clearInterval(fallbackTimer);
          
          importProgress.value = 100;
          importStatusText.value = 'Database lokal berhasil disinkronkan harian! (API Offline Fallback)';
          importSuccessCount.value = cleanItems.length;

          // Save locally
          store.importData('inbound', cleanItems);
          processLocalInboundsMapping(cleanItems);
          
          showNotification(`[Fallback] Berhasil mengimpor ${cleanItems.length} paket Inbound harian.`, 'success');

          setTimeout(() => {
            isImporting.value = false;
            discardDraft();
          }, 2000);
        } else {
          importProgress.value = fallbackTick;
          importStatusText.value = `Memproses data cadangan internal offline (${importProgress.value}%)...`;
        }
      }
    }, 60);
  });
}

function discardDraft() {
  rawParsedItems.value = [];
  validationErrors.value = [];
  totalParsedRows.value = 0;
  activeUploadedFileName.value = '';
  parsedFileText.value = '';
}

// API Loading states
const apiLoading = ref(false);
const apiError = ref<string | null>(null);
const apiSuccess = ref(false);
const isCreating = ref(false);
const lastFetchTime = ref<string | null>(null);

// Inbound Items State with LocalStorage mapping & fallbacks
const INITIAL_INBOUND = [
  { name: 'Slot A - Pagi (08:00 - 12:00)', date_inbound: '2026-05-31', actual_arrival: '08:30', total_order: 12 },
  { name: 'Slot B - Siang (12:00 - 16:00)', date_inbound: '2026-05-31', actual_arrival: '13:15', total_order: 25 },
  { name: 'Slot C - Sore (16:00 - 20:00)', date_inbound: '2026-05-31', actual_arrival: '18:45', total_order: 8 }
];

const savedInbounds = localStorage.getItem('logistics_inbounds');
const apiInboundItems = ref<any[]>(savedInbounds ? JSON.parse(savedInbounds) : INITIAL_INBOUND);

// Table scheme Columns definition without time_start, time_end, or ID Slot
const inboundColumns = [
  { key: 'name', label: 'Tipe Slot', type: 'string' },
  { key: 'date_inbound_formatted', label: 'Tanggal Inbound', type: 'string' },
  { key: 'actual_arrival_formatted', label: 'Kedatangan Aktual', type: 'string' },
  { key: 'total_order', label: 'Total Order', type: 'number' }
];

// Reactive states for filters
const filterTypeSlot = ref<string>('');
const filterStartDate = ref<string>('');
const filterEndDate = ref<string>('');
const filterArrivalStart = ref<string>('');
const filterArrivalEnd = ref<string>('');
const activePreset = ref<string>('all');

// Custom Date Picker Popover States matching screenshot exactly
const showDatePickerPopover = ref(false);
const tempStartDate = ref('');
const tempEndDate = ref('');
const tempActivePreset = ref('all');

function toggleDatePickerPopover() {
  if (!showDatePickerPopover.value) {
    // Sync current active values into temporary popover buffer
    tempStartDate.value = filterStartDate.value;
    tempEndDate.value = filterEndDate.value;
    tempActivePreset.value = activePreset.value || 'custom';
  }
  showDatePickerPopover.value = !showDatePickerPopover.value;
}

// Visual Interactive Month Calendar State for modern date range drawing
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth()); // 0-11
const hoveredDate = ref<string | null>(null);

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface CalendarDay {
  dateString: string; // YYYY-MM-DD
  dayNum: number;
  isCurrentMonth: boolean;
}

// Compute the standard grid representing the days for the visually selected month
const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  
  // Day index of first day of the month
  const firstDayObj = new Date(year, month, 1);
  let firstDayIndex = firstDayObj.getDay(); // 0 is Sunday, 1 is Monday ...
  // Adapt Sunday logic: convert Sunday(0) to index 6, Monday(1) to index 0...
  const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();
  
  const days: CalendarDay[] = [];
  
  // Padding from previous month
  for (let i = offset - 1; i >= 0; i--) {
    const d = prevTotalDays - i;
    const prevMonthVal = month === 0 ? 11 : month - 1;
    const prevYearVal = month === 0 ? year - 1 : year;
    const dateStr = `${prevYearVal}-${String(prevMonthVal + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dateString: dateStr,
      dayNum: d,
      isCurrentMonth: false
    });
  }
  
  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dateString: dateStr,
      dayNum: d,
      isCurrentMonth: true
    });
  }
  
  // Padding from next month
  const totalCells = 42; // standard 6 rows grid
  const nextMonthPadding = totalCells - days.length;
  for (let d = 1; d <= nextMonthPadding; d++) {
    const nextMonthVal = month === 11 ? 0 : month + 1;
    const nextYearVal = month === 11 ? year + 1 : year;
    const dateStr = `${nextYearVal}-${String(nextMonthVal + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dateString: dateStr,
      dayNum: d,
      isCurrentMonth: false
    });
  }
  
  return days;
});

// Selects or draws visual date start/end ranges on clicking calendar days
function selectCalendarDay(dateStr: string) {
  tempActivePreset.value = 'custom'; // manual drawing overrides preset tags
  
  if (!tempStartDate.value || (tempStartDate.value && tempEndDate.value)) {
    tempStartDate.value = dateStr;
    tempEndDate.value = '';
  } else {
    // Second click
    if (dateStr < tempStartDate.value) {
      // Swaps the selection if chosen date is prior to start
      tempStartDate.value = dateStr;
    } else {
      tempEndDate.value = dateStr;
    }
  }
}

// Interactive range highlighting checks
function isDayStart(dateStr: string): boolean {
  return tempStartDate.value === dateStr;
}

function isDayEnd(dateStr: string): boolean {
  return tempEndDate.value === dateStr;
}

function isDayInBetween(dateStr: string): boolean {
  if (!tempStartDate.value) return false;
  const start = tempStartDate.value;
  
  if (tempEndDate.value) {
    const end = tempEndDate.value;
    return dateStr > start && dateStr < end;
  }
  
  // Highlight dynamically while hovering if mouse is on empty end date
  if (hoveredDate.value) {
    const candidate = hoveredDate.value;
    if (candidate > start) {
      return dateStr > start && dateStr < candidate;
    }
  }
  
  return false;
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value += 1;
  } else {
    currentMonth.value += 1;
  }
}

// Function to move to the previous month
function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value -= 1;
  } else {
    currentMonth.value -= 1;
  }
}

// Function to dynamically apply date presets within the popover panel (Last Week, Last Month, etc.)
function selectPreset(preset: 'all' | '7days' | '30days' | 'year') {
  tempActivePreset.value = preset;
  const today = new Date();
  const getFormatted = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (preset === 'all') {
    tempStartDate.value = '';
    tempEndDate.value = '';
  } else if (preset === '7days') {
    const past = new Date();
    past.setDate(today.getDate() - 7);
    tempStartDate.value = getFormatted(past);
    tempEndDate.value = getFormatted(today);
  } else if (preset === '30days') {
    const past = new Date();
    past.setDate(today.getDate() - 30);
    tempStartDate.value = getFormatted(past);
    tempEndDate.value = getFormatted(today);
  } else if (preset === 'year') {
    const firstDay = new Date(today.getFullYear(), 0, 1);
    tempStartDate.value = getFormatted(firstDay);
    tempEndDate.value = getFormatted(today);
  }
}

// Applies temporary date popover values to actual active filters
function applyDateRange() {
  filterStartDate.value = tempStartDate.value;
  filterEndDate.value = tempEndDate.value;
  activePreset.value = tempActivePreset.value;
  showDatePickerPopover.value = false;
  showNotification('Saringan rentang tanggal berhasil diterapkan', 'success');
}

// computed string display helper for the trigger button
const activeRangeString = computed(() => {
  if (!filterStartDate.value && !filterEndDate.value) {
    return 'Semua Data Inbound (All)';
  }
  if (filterStartDate.value && !filterEndDate.value) {
    return `${formatFriendlyDate(filterStartDate.value)} s/d ...`;
  }
  if (filterStartDate.value && filterEndDate.value) {
    if (filterStartDate.value === filterEndDate.value) {
      return formatFriendlyDate(filterStartDate.value);
    }
    return `${formatFriendlyDate(filterStartDate.value)} s/d ${formatFriendlyDate(filterEndDate.value)}`;
  }
  return 'Semua Data Inbound';
});

// Parses time down to precise HH:MM (cukup jam dan menit saja; tidak double atau over-detailed)
function formatFriendlyTime(timeStr: string): string {
  if (!timeStr) return '';
  // Check if string is a full ISO date + time stamp
  if (timeStr.includes('T')) {
    const splitTime = timeStr.split('T')[1];
    if (splitTime) {
      return splitTime.substring(0, 5);
    }
  }
  // Standard format check HH:MM:SS
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return timeStr;
}

// Function to format standard YYYY-MM-DD or full ISO strings into a user-friendly format (e.g., "1 Jun 2026")
function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    let datePart = dateStr.trim();
    if (datePart.includes('T')) {
      datePart = datePart.split('T')[0];
    } else {
      datePart = datePart.split(' ')[0];
    }
    
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthIndex = parseInt(month, 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${parseInt(day, 10)} ${months[monthIndex]} ${year}`;
      }
      return `${day}-${month}-${year}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

// Filter and map items with friendly dates dynamically
const filteredAndFormattedItems = computed(() => {
  return apiInboundItems.value.map(item => {
    let slotName = item.name;
    const slotId = item.id_type_slot || item.type_slot_id || item.slot_id;
    if (slotId && (!slotName || slotName.startsWith('ID Slot:') || slotName.startsWith('Slot '))) {
      const found = typeSlots.value.find(s => String(s.id) === String(slotId));
      if (found) {
        slotName = found.name;
      }
    }
    return {
      ...item,
      name: slotName || item.name || `Slot ${slotId || ''}`,
      date_inbound_formatted: formatFriendlyDate(item.date_inbound),
      actual_arrival_formatted: formatFriendlyTime(item.actual_arrival)
    };
  }).filter(item => {
    // 1. Tipe Slot Filter
    if (filterTypeSlot.value) {
      const itemSlotId = String(item.id_type_slot || '');
      const filterValStr = String(filterTypeSlot.value);
      if (itemSlotId !== filterValStr) {
        return false;
      }
    }

    // 2. Date Inbound Range Filter
    let itemDate = item.date_inbound || '';
    if (itemDate.includes('T')) {
      itemDate = itemDate.split('T')[0];
    } else {
      itemDate = itemDate.split(' ')[0];
    }
    itemDate = itemDate.trim();

    if (filterStartDate.value && itemDate < filterStartDate.value) {
      return false;
    }
    if (filterEndDate.value && itemDate > filterEndDate.value) {
      return false;
    }

    // 3. Jam Aktual Arrival Range Filter
    let itemTime = (item.actual_arrival || '').trim();
    if (itemTime) {
      const itemHm = itemTime.substring(0, 5); // get HH:MM
      
      if (filterArrivalStart.value) {
        const startHm = filterArrivalStart.value.trim().substring(0, 5);
        if (itemHm < startHm) return false;
      }
      
      if (filterArrivalEnd.value) {
        const endHm = filterArrivalEnd.value.trim().substring(0, 5);
        if (itemHm > endHm) return false;
      }
    }

    return true;
  });
});

function clearFilters() {
  filterTypeSlot.value = '';
  filterStartDate.value = '';
  filterEndDate.value = '';
  filterArrivalStart.value = '';
  filterArrivalEnd.value = '';
  activePreset.value = 'all';
  
  tempStartDate.value = '';
  tempEndDate.value = '';
  tempActivePreset.value = 'all';
  showNotification('Semua filter berhasil dibersihkan', 'success');
}

interface TypeSlotOption {
  id: number | string;
  name: string;
}

// Dropdown Type Slots dynamic API resource
const typeSlots = ref<TypeSlotOption[]>([]);
const slotsLoading = ref(false);
const slotsError = ref<string | null>(null);

// Form Control state
const showForm = ref(false);

const formTypeSlot = ref<number | string>('');
const formDateInbound = ref('');
const formActualArrival = ref('');
const formTotalOrder = ref<number | null>(null);

// Notification State
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
  notification.value = { message, type };
  setTimeout(() => {
    notification.value = null;
  }, 4500);
}

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Fetch list of Type Slots from external local API
async function fetchTypeSlots() {
  slotsLoading.value = true;
  slotsError.value = null;
  try {
    const response = await api.get('/type-slots');
    const data = response.data;
    let rawSlots: any[] = [];
    if (Array.isArray(data)) {
      rawSlots = data;
    } else if (data && Array.isArray(data.data)) {
      rawSlots = data.data;
    } else if (data && typeof data === 'object') {
      rawSlots = data.slots || data.type_slots || data.data || [];
      if (!Array.isArray(rawSlots)) {
        rawSlots = Object.values(data);
      }
    }

    const mappedSlots: TypeSlotOption[] = rawSlots.map((item: any, index: number) => {
      if (typeof item === 'string') {
        return { id: index + 1, name: item };
      }
      const idVal = item.id !== undefined && item.id !== null ? item.id : (index + 1);
      const nameVal = item.name || item.type || item.slot_name || item.value || `Slot ${idVal}`;
      return { id: idVal, name: nameVal };
    }).filter(s => s && s.name);

    if (mappedSlots.length > 0) {
      typeSlots.value = mappedSlots;
    } else {
      useFallbackSlots();
    }
  } catch (err: any) {
    console.warn('Gagal memuat type-slots dari API, menggunakan fallback lokal:', err.message);
    slotsError.value = 'API Offline';
    useFallbackSlots();
  } finally {
    slotsLoading.value = false;
    if (typeSlots.value.length > 0 && !formTypeSlot.value) {
      formTypeSlot.value = typeSlots.value[0].id;
    }
  }
}

function useFallbackSlots() {
  typeSlots.value = [
    { id: 1, name: 'Slot A - Pagi (08:00 - 12:00)' },
    { id: 2, name: 'Slot B - Siang (12:00 - 16:00)' },
    { id: 3, name: 'Slot C - Sore (16:00 - 20:00)' },
    { id: 4, name: 'Slot D - Malam (20:00 - 24:00)' }
  ];
}

// Fetch Custom Inbound lists from main API /inbounds
async function fetchInboundsApi() {
  apiLoading.value = true;
  apiError.value = null;
  apiSuccess.value = false;
  try {
    const response = await api.get('/inbounds');
    const data = response.data;
    let rawItems: any[] = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data && Array.isArray(data.data)) {
      rawItems = data.data;
    } else if (data && typeof data === 'object') {
      rawItems = [data];
    } else {
      throw new Error('Format data JSON tidak didukung (harus berupa Array)');
    }

    const mappedInbounds = rawItems.map((item: any) => {
      const slotId = item.id_type_slot || item.type_slot_id || item.slot_id || item.type_slot;
      let slotName = item.type_slot || item.name || item.nama;
      
      if (!slotName && slotId) {
        const found = typeSlots.value.find(s => String(s.id) === String(slotId));
        if (found) {
          slotName = found.name;
        } else {
          slotName = `ID Slot: ${slotId}`;
        }
      }
      
      return {
        id_type_slot: slotId || 1,
        name: slotName || `Slot ${Math.floor(100 + Math.random() * 900)}`,
        date_inbound: item.date_inbound || item.tanggal || getTodayString(),
        actual_arrival: item.actual_arrival || item.actual_arrivals || item.kedatangan_aktual || '10:00',
        total_order: Number(item.total_order) || Number(item.jumlah_order) || 1
      };
    });

    apiInboundItems.value = mappedInbounds;
    localStorage.setItem('logistics_inbounds', JSON.stringify(mappedInbounds));
    apiSuccess.value = true;
    lastFetchTime.value = new Date().toLocaleTimeString('id-ID');
    showNotification(`Berhasil menyinkronkan ${mappedInbounds.length} data Inbound dari API.`, 'success');
  } catch (err: any) {
    console.error('Inbound API Fetch failed:', err);
    apiError.value = err.response?.data?.message || err.message || 'Koneksi ditolak oleh API lokal (CORS / Server Offline).';
    showNotification('Gagal terhubung ke API Inbound. Menggunakan database lokal.', 'info');
  } finally {
    apiLoading.value = false;
  }
}

// Post dynamic Inbound item to REST API /inbounds
async function submitInbound() {
  if (!formTypeSlot.value || !formDateInbound.value || !formActualArrival.value || formTotalOrder.value === null) {
    showNotification('Harap lengkapi semua field formulir!', 'error');
    return;
  }

  isCreating.value = true;
  
  // Format precisely matches instructions: id_type_slot, date_inbound, actual_arrival, total_order.
  // We ensure id_type_slot is cast to standard integer format if it's numeric.
  const numericId = Number(formTypeSlot.value);
  const slotIdValue = isNaN(numericId) ? formTypeSlot.value : numericId;

  let formattedArrival = formActualArrival.value ? formActualArrival.value.trim() : '00:00:00';
  if (formattedArrival.split(':').length === 2) {
    formattedArrival += ':00';
  }

  const payload = {
    id_type_slot: slotIdValue,
    date_inbound: formDateInbound.value,
    actual_arrival: formattedArrival,
    total_order: Number(formTotalOrder.value)
  };

  try {
    const response = await api.post('/inbounds', payload);
    const feedbackMsg = response.data?.message || 'Data inbound baru berhasil dibuat di database server!';
    showNotification(`Sukses! ${feedbackMsg}`, 'success');
    await fetchInboundsApi();
    resetForm();
  } catch (err: any) {
    console.error('POST ke API /inbounds gagal:', err);
    
    if (err.response) {
      // The server was reached but returned an error status (e.g. 422, 500, 400)
      const serverError = err.response.data?.message || 
                          err.response.data?.error || 
                          (err.response.data?.errors ? JSON.stringify(err.response.data.errors) : '') || 
                          `Status ${err.response.status}`;
      showNotification(`Gagal Input ke Database API: ${serverError}`, 'error');
    } else {
      // Server is offline or network/CORS error
      // Store in browser state fallback
      const localInbounds = [...apiInboundItems.value];
      
      // Find text slot name for locally viewed representation
      const foundSlot = typeSlots.value.find(s => String(s.id) === String(payload.id_type_slot));
      const viewItem = {
        id_type_slot: payload.id_type_slot,
        name: foundSlot ? foundSlot.name : `Slot ID: ${payload.id_type_slot}`,
        date_inbound: payload.date_inbound,
        actual_arrival: payload.actual_arrival,
        total_order: payload.total_order
      };
      
      localInbounds.unshift(viewItem);
      apiInboundItems.value = localInbounds;
      localStorage.setItem('logistics_inbounds', JSON.stringify(localInbounds));
      
      showNotification('API Offline. Data tersimpan di database lokal browser.', 'info');
      resetForm();
    }
  } finally {
    isCreating.value = false;
  }
}

function resetForm() {
  formTypeSlot.value = typeSlots.value[0]?.id || '';
  formDateInbound.value = getTodayString();
  formActualArrival.value = '10:00';
  formTotalOrder.value = null;
  showForm.value = false;
}

function onClearData() {
  if (confirm(`Apakah Anda yakin ingin menghapus seluruh data Inbound lokal?`)) {
    apiInboundItems.value = [];
    localStorage.setItem('logistics_inbounds', JSON.stringify([]));
    showNotification('Semua data inbound lokal telah dibersihkan.', 'info');
  }
}

// On mount trigger dependencies
onMounted(() => {
  formDateInbound.value = getTodayString();
  formActualArrival.value = '09:00';
  fetchTypeSlots();
  fetchInboundsApi();
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
              <h3 class="text-sm font-bold text-slate-900 border-none">
                Integrasi FMS Inbound (REST API)
              </h3>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border"
                :class="apiError ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'"
              >
                {{ apiError ? 'API Offline (Fallback Lokal)' : 'API Terhubung' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 max-w-lg leading-relaxed mt-1">
              Data inbound logistik tersinkronisasi langsung ke backend:
              <code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">127.0.0.1:8000/api/inbounds</code>.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Button Input Manual -->
          <button 
            id="btn-show-form"
            type="button"
            class="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition select-none cursor-pointer"
            @click="showForm = !showForm"
          >
            <ListPlus class="w-4 h-4 text-blue-600" />
            {{ showForm ? 'Tutup Formulir' : 'Input Data Inbound' }}
          </button>

          <!-- Button Sync API -->
          <button 
            id="btn-sync-inbound"
            type="button" 
            class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer disabled:opacity-55 select-none"
            :disabled="apiLoading"
            @click="fetchInboundsApi"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{'animate-spin': apiLoading}" />
            {{ apiLoading ? 'Menghubungkan...' : 'Sinkronkan Data FMS' }}
          </button>
        </div>
      </div>

      <!-- Sync feedback States -->
      <div v-if="apiSuccess" class="p-3.5 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2.5">
        <CheckCircle2 class="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
        <div class="text-xs text-green-800 space-y-0.5 leading-relaxed">
          <p class="font-bold">Koneksi Berhasil!</p>
          <p>Membaca database inbound secara aktif dari server lokal pada pukul <b>{{ lastFetchTime }}</b>.</p>
        </div>
      </div>

      <div v-if="apiError" class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-xs text-amber-900 space-y-1.5 leading-relaxed">
          <p class="font-bold">Gagal Terhubung ke http://127.0.0.1:8000/api/inbounds</p>
          <p class="text-2xs text-slate-500">Sistem mendeteksi endpoint server lokal offline. Anda tetap dapat memasukkan data inbound secara lancar memanfaatkan database internal (web cache) yang terpasang otomatis.</p>
        </div>
      </div>

      <!-- Manual Input Form Segment -->
      <div 
        v-if="showForm" 
        class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 animate-fade-in"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <h4 class="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Clock class="w-4 h-4 text-blue-600 animate-pulse" />
            Input Data Inbound Baru
          </h4>
          <span class="text-3xs text-blue-600 font-bold">WMS Inbounds</span>
        </div>

        <form @submit.prevent="submitInbound" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Type Slot Dropdown from API -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Type Slot (Pilihan dari API) *</label>
            <div class="relative">
              <select 
                v-model="formTypeSlot" 
                class="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                required
              >
                <option v-for="slot in typeSlots" :key="slot.id" :value="slot.id">
                  {{ slot.name }}
                </option>
              </select>
              <div v-if="slotsLoading" class="absolute right-2.5 top-2.5 text-2xs text-slate-400 flex items-center gap-1">
                <RefreshCw class="w-3 h-3 animate-spin text-blue-600" />
              </div>
            </div>
          </div>

          <!-- Date Inbound -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Inbound *</label>
            <input 
              v-model="formDateInbound" 
              type="date" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Actual Arrival Time -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Kedatangan Aktual *</label>
            <input 
              v-model="formActualArrival" 
              type="time" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Total Order -->
          <div class="space-y-1">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider">Total Order *</label>
            <input 
              v-model="formTotalOrder" 
              type="number" 
              min="1"
              step="1"
              placeholder="Contoh: 15" 
              class="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <!-- Submit Button -->
          <div class="flex items-end col-span-1 md:col-span-2 lg:col-span-4">
            <button 
              id="btn-add-cutoff-submit"
              type="submit" 
              class="w-full md:w-56 ml-auto py-2.5 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
              :disabled="isCreating"
            >
              <Loader2 v-if="isCreating" class="w-3.5 h-3.5 animate-spin" />
              <Send v-else class="w-3.5 h-3.5" />
              {{ isCreating ? 'Menyimpan...' : 'Kirim Data Inbound' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- File Upload Section for CSV/Excel -->
    <FileUpload 
      menu-key="inbound"
      menu-label="Import Data Inbound (CSV/Excel)"
      :has-data="apiInboundItems.length > 0"
      @file-parsed="onFileParsed"
      @clear-data="onClearData"
    />

    <!-- Verification Analysis / Importing Progress -->
    <div v-if="isImporting" class="bg-white border-2 border-blue-105 rounded-xl p-6 shadow-xs mb-6 animate-fade-in space-y-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <RefreshCw class="w-5 h-5 text-blue-650 animate-spin" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-805">Sedang Mengimpor Data Inbound...</h4>
            <p class="text-xs text-slate-500 mt-0.5">File: <code class="font-mono bg-slate-50 px-1 py-0.5 rounded text-blue-600">{{ activeUploadedFileName }}</code></p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-lg font-extrabold text-blue-600 font-mono">{{ importProgress }}%</span>
        </div>
      </div>

      <!-- Linear Progress Bar -->
      <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          class="h-full bg-blue-600 transition-all duration-300 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
          :style="{ width: `${importProgress}%` }"
        ></div>
      </div>

      <!-- Detail status & steps -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <!-- Step 1: Uploading FMS -->
        <div class="p-3 border rounded-lg flex items-start gap-2 text-xs" :class="importProgress >= 30 ? 'bg-green-50/50 border-green-150' : 'bg-slate-50/50 border-slate-200 text-slate-400'">
          <CheckCircle2 v-if="importProgress >= 30" class="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <Loader2 v-else-if="importProgress > 0" class="w-4 h-4 text-blue-500 animate-spin shrink-0 mt-0.5" />
          <div class="space-y-0.5">
            <p class="font-bold" :class="importProgress >= 30 ? 'text-green-800' : 'text-slate-700'">1. Upload Berkas</p>
            <p class="text-[11px]" :class="importProgress >= 30 ? 'text-green-600' : 'text-slate-450'">Mengirimkan ke FMS API upload.</p>
          </div>
        </div>

        <!-- Step 2: Validation -->
        <div class="p-3 border rounded-lg flex items-start gap-2 text-xs" :class="importProgress >= 65 ? 'bg-green-50/50 border-green-150' : (importProgress >= 30 ? 'bg-blue-50/40 border-blue-200 text-blue-850' : 'bg-slate-50/50 border-slate-200 text-slate-400')">
          <CheckCircle2 v-if="importProgress >= 65" class="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <Loader2 v-else-if="importProgress >= 30" class="w-4 h-4 text-blue-500 animate-spin shrink-0 mt-0.5" />
          <div class="space-y-0.5">
            <p class="font-bold" :class="importProgress >= 65 ? 'text-green-800' : (importProgress >= 30 ? 'text-blue-800' : 'text-slate-700')">2. Saring & Validasi</p>
            <p class="text-[11px]" :class="importProgress >= 65 ? 'text-green-600' : (importProgress >= 30 ? 'text-blue-600' : 'text-slate-450')">Mengurai kolom data inbounds.</p>
          </div>
        </div>

        <!-- Step 3: Local Sync -->
        <div class="p-3 border rounded-lg flex items-start gap-2 text-xs" :class="importProgress >= 100 ? 'bg-green-50/50 border-green-150' : (importProgress >= 65 ? 'bg-blue-50/40 border-blue-200 text-blue-850' : 'bg-slate-50/50 border-slate-200 text-slate-400')">
          <CheckCircle2 v-if="importProgress >= 100" class="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <Loader2 v-else-if="importProgress >= 65" class="w-4 h-4 text-blue-500 animate-spin shrink-0 mt-0.5" />
          <div class="space-y-0.5">
            <p class="font-bold" :class="importProgress >= 100 ? 'text-green-800' : (importProgress >= 65 ? 'text-blue-800' : 'text-slate-700')">3. Sinkronisasi DB</p>
            <p class="text-[11px]" :class="importProgress >= 100 ? 'text-green-600' : (importProgress >= 65 ? 'text-blue-600' : 'text-slate-450')">Penyimpanan harian ke gudang.</p>
          </div>
        </div>
      </div>

      <!-- Current Processing Action description text -->
      <div class="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
        <span class="text-slate-600 font-medium flex items-center gap-1.5">
          <Loader2 class="w-3.5 h-3.5 text-blue-500 animate-spin" v-if="importProgress < 100" />
          {{ importStatusText }}
        </span>
        <span class="text-[11px] text-slate-400 font-bold bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs font-mono">FMS-UPLOADER-V1</span>
      </div>
    </div>

    <!-- Verification Analysis -->
    <ValidationResult 
      v-else-if="totalParsedRows > 0"
      :errors="validationErrors"
      :total-rows="totalParsedRows"
      @confirm="onConfirmImport"
      @cancel="discardDraft"
    />

    <!-- List Preview Grid Table -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <TableProperties class="w-3.5 h-3.5 text-blue-600" />
            Tabel Inbound Terdaftar
          </h3>
          <p class="text-2xs text-slate-500 leading-normal mt-0.5">
            Daftar slot inbound logistik real-time yang tersimpan di sistem pergudangan.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Button delete all -->
          <button 
            type="button"
            class="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition border border-dashed border-slate-200 hover:border-rose-200 select-none cursor-pointer"
            title="Bersihkan Data"
            @click="onClearData"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Interactive Filters Section -->
      <div v-if="apiInboundItems.length > 0" class="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
          <div class="flex items-center gap-2 text-xs font-bold text-slate-800 select-none">
            <Filter class="w-4 h-4 text-blue-600" />
            <span>Penyaringan Data Inbound Terpadu</span>
          </div>
          
          <div class="flex items-center gap-2">
            <button 
              v-if="filterTypeSlot || filterStartDate || filterEndDate || filterArrivalStart || filterArrivalEnd"
              type="button"
              class="text-3xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-rose-200 shadow-2xs select-none"
              @click="clearFilters"
            >
              <X class="w-3 h-3" />
              Bersihkan Filter
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <!-- 1. Tipe Slot Dropdown -->
          <div class="space-y-1.5 col-span-1 md:col-span-4 balance">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider select-none">Saring Sesuai Tipe Slot</label>
            <select 
              v-model="filterTypeSlot"
              class="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700 font-semibold h-[38px] flex items-center justify-between shadow-2xs"
            >
              <option value="">Semua Tipe Slot</option>
              <option v-for="slot in typeSlots" :key="slot.id" :value="slot.id">
                {{ slot.name }}
              </option>
            </select>
          </div>

          <!-- 2. Rich Compact Popover Date Picker (Aligned exactly to user image feedback!) -->
          <div class="space-y-1.5 col-span-1 md:col-span-4 relative">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 select-none">
              <Calendar class="w-3 h-3 text-blue-600 shrink-0" />
              Rentang Tanggal Inbound
            </label>
            
            <!-- Trigger Button -->
            <button 
              type="button"
              class="w-full text-xs p-2 px-2.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-700 font-semibold flex items-center justify-between shadow-2xs hover:bg-slate-50 transition cursor-pointer select-none h-[38px]"
              @click="toggleDatePickerPopover"
            >
              <span class="flex items-center gap-2 truncate">
                <Calendar class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span class="truncate text-slate-600 font-bold text-2xs">{{ activeRangeString }}</span>
              </span>
              <ChevronDown class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200" :class="{'rotate-180': showDatePickerPopover}" />
            </button>

            <!-- Closes the Popover whenever user clicks any outside elements -->
            <div 
              v-if="showDatePickerPopover" 
              class="fixed inset-0 z-40 bg-transparent" 
              @click="showDatePickerPopover = false"
            ></div>

            <!-- POPUP CONTAINER CARD: Strictly Replicating the Visual Structure & Proportions of User Image -->
            <div 
              v-if="showDatePickerPopover" 
              class="absolute left-0 sm:left-auto sm:right-0 md:left-0 mt-2 z-50 bg-white border border-slate-220 rounded-2xl shadow-xl flex flex-col sm:flex-row overflow-hidden animate-fade-in divide-y sm:divide-y-0 sm:divide-x divide-slate-150 w-[420px] max-w-[95vw] sm:w-[460px]"
            >
              <!-- LEFT RANGE PRESETS COLUMN (Grey sidebar with Apply at critical bottom) -->
              <div class="w-full sm:w-32 bg-slate-50/70 p-2.5 flex flex-col justify-between shrink-0 space-y-4">
                <div class="space-y-1 select-none">
                  <!-- Last Week Preset -->
                  <button 
                    type="button"
                    class="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                    :class="tempActivePreset === '7days' 
                      ? 'bg-slate-150 text-slate-900 font-bold' 
                      : 'text-slate-605 hover:bg-slate-100'"
                    @click="selectPreset('7days')"
                  >
                    Last Week
                  </button>

                  <!-- Last Month Preset -->
                  <button 
                    type="button"
                    class="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                    :class="tempActivePreset === '30days' 
                      ? 'bg-slate-150 text-slate-900 font-bold' 
                      : 'text-slate-605 hover:bg-slate-100'"
                    @click="selectPreset('30days')"
                  >
                    Last Month
                  </button>

                  <!-- Last Year Preset -->
                  <button 
                    type="button"
                    class="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                    :class="tempActivePreset === 'year' 
                      ? 'bg-slate-150 text-slate-900 font-bold' 
                      : 'text-slate-605 hover:bg-slate-100'"
                    @click="selectPreset('year')"
                  >
                    Last Year
                  </button>

                  <!-- All / Reset Preset -->
                  <button 
                    type="button"
                    class="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                    :class="tempActivePreset === 'all' 
                      ? 'bg-slate-150 text-slate-900 font-bold' 
                      : 'text-slate-605 hover:bg-slate-100'"
                    @click="selectPreset('all')"
                  >
                    All Times
                  </button>

                  <!-- Custom drawing tag -->
                  <button 
                    type="button"
                    class="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                    :class="tempActivePreset === 'custom' 
                      ? 'bg-slate-150 text-slate-900 font-bold' 
                      : 'text-slate-605 hover:bg-slate-100'"
                    @click="tempActivePreset = 'custom'"
                  >
                    Custom
                  </button>
                </div>

                <!-- Apply Dark Colored solid CTA Button -->
                <button 
                  type="button"
                  class="w-full py-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-white text-[11px] font-bold rounded-lg transition-colors duration-150 shadow-sm cursor-pointer select-none"
                  @click="applyDateRange"
                >
                  Apply
                </button>
              </div>

              <!-- RIGHT MONTH CALENDAR (Miniature visual interactive table) -->
              <div class="flex-1 p-3 bg-white flex flex-col justify-between">
                <div>
                  <!-- Calendar control header Mon YYYY -->
                  <div class="flex items-center justify-between pb-2 border-b border-slate-100 select-none">
                    <button 
                      type="button"
                      class="p-0.5 hover:bg-slate-100 border border-slate-205 rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
                      @click="prevMonth"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span class="text-[11px] font-extrabold text-slate-800 font-sans tracking-tight">
                      {{ monthNames[currentMonth] }} {{ currentYear }}
                    </span>
                    <button 
                      type="button"
                      class="p-0.5 hover:bg-slate-100 border border-slate-205 rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
                      @click="nextMonth"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  <!-- Days Names header row (Replicating "Mon Tue Wed Thu Fri Sat Sun") -->
                  <div class="grid grid-cols-7 text-center font-bold text-slate-400 py-1 text-[9px] uppercase tracking-wider select-none">
                    <div v-for="dName in dayNames" :key="dName">
                      {{ dName }}
                    </div>
                  </div>

                  <!-- Calendar Days grids with elegant capsule overlays -->
                  <div class="grid grid-cols-7 gap-y-[3px] gap-x-[3px] mt-1">
                    <button
                      v-for="day in calendarDays"
                      :key="day.dateString"
                      type="button"
                      class="relative aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all cursor-pointer select-none font-semibold outline-hidden"
                      :class="[
                        day.isCurrentMonth ? 'text-slate-705 hover:bg-slate-100' : 'text-slate-300 pointer-events-none opacity-30',
                        isDayStart(day.dateString) ? 'bg-[#0f172a] text-white font-bold scale-105 z-10 rounded-lg shadow-2xs' : '',
                        isDayEnd(day.dateString) ? 'bg-[#0f172a] text-white font-bold scale-105 z-10 rounded-lg shadow-2xs' : '',
                        isDayInBetween(day.dateString) ? 'bg-slate-100 text-slate-800 font-semibold' : ''
                      ]"
                      @click="selectCalendarDay(day.dateString)"
                      @mouseenter="hoveredDate = day.dateString"
                      @mouseleave="hoveredDate = null"
                    >
                      <span>{{ day.dayNum }}</span>
                      <!-- visual live indicators for today date representation -->
                      <div 
                        v-if="day.dateString === getTodayString() && !isDayStart(day.dateString) && !isDayEnd(day.dateString)" 
                        class="absolute bottom-0.5 w-[3px] h-[3px] rounded-full bg-slate-900"
                      ></div>
                    </button>
                  </div>
                </div>

                <!-- Helper view panel: shows selection status -->
                <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 select-none">
                  <span class="truncate">
                    Mulai: 
                    <b class="text-slate-700 font-bold font-mono">{{ tempStartDate ? formatFriendlyDate(tempStartDate) : '-' }}</b>
                  </span>
                  <span class="text-slate-300 mx-1">|</span>
                  <span class="truncate">
                    Selesai: 
                    <b class="text-slate-700 font-bold font-mono">{{ tempEndDate ? formatFriendlyDate(tempEndDate) : '-' }}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Jam Kedatangan Aktual (Interval input field row) -->
          <div class="space-y-1.5 col-span-1 md:col-span-4 rounded-lg">
            <label class="block text-3xs font-bold text-slate-500 uppercase tracking-wider select-none">Jam Kedatangan Aktual (Interval)</label>
            <div class="flex items-center gap-1.5 h-[38px] bg-white border border-slate-200 rounded-lg p-1 px-3 shadow-2xs">
              <input 
                v-model="filterArrivalStart"
                type="time"
                class="w-1/2 text-xs bg-transparent border-none outline-none text-slate-700 font-semibold text-center cursor-pointer h-full"
              />
              <span class="text-slate-400 text-xs font-bold leading-none shrink-0">&#8212;</span>
              <input 
                v-model="filterArrivalEnd"
                type="time"
                class="w-1/2 text-xs bg-transparent border-none outline-none text-slate-700 font-semibold text-center cursor-pointer h-full"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state illustration -->
      <div v-if="apiInboundItems.length === 0" class="p-8 text-center text-xs text-slate-500 space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 animate-fade-in">
        <AlertTriangle class="w-8 h-8 text-amber-500 mx-auto" />
        <p class="font-bold text-slate-700">Belum Ada Data Inbound</p>
        <p class="max-w-md mx-auto">Klik tombol <b class="text-slate-800">"Sinkronkan Data FMS"</b> di atas atau klik <b class="text-slate-800">"Input Data Inbound"</b> untuk mendaftarkan inbound baru.</p>
      </div>

      <DataPreviewTable 
        v-else
        :items="filteredAndFormattedItems"
        :columns="inboundColumns"
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
