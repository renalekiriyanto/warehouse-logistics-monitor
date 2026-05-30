<script setup lang="ts">
import { ref } from 'vue';
import { useLogisticsStore } from '../../store/logisticsStore';
import { parseCSV } from '../../utils/csvParser';
import FileUpload from '../../components/FileUpload.vue';
import DataPreviewTable from '../../components/DataPreviewTable.vue';
import ValidationResult from '../../components/ValidationResult.vue';
import { TableProperties } from 'lucide-vue-next';

const store = useLogisticsStore();

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

// Columns definition for expedite
const columns = [
  { key: 'resi', label: 'No Resi', type: 'string' },
  { key: 'itemName', label: 'Nama Paket', type: 'string' },
  { key: 'deadline', label: 'Waktu Batas', type: 'string' },
  { key: 'courier', label: 'Kurir', type: 'string' },
  { key: 'urgency', label: 'Tingkat Urgensi', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' }
];
</script>

<template>
  <div id="expedite-menu-comp" class="space-y-6">
    <!-- File Upload Section -->
    <FileUpload 
      menu-key="expedite"
      menu-label="Inbound Expedite Cargo"
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

    <!-- Database Preview Table -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <TableProperties class="w-3.5 h-3.5" />
          Preview Database Expedite (Total: {{ store.expedite.length }})
        </h3>
        <span class="text-2xs font-semibold text-slate-500 font-sans">Penyimpanan Terpasang: Lokal browser</span>
      </div>

      <DataPreviewTable 
        :items="store.expedite"
        :columns="columns"
      />
    </div>
  </div>
</template>
