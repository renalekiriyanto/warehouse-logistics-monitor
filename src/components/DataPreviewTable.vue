<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ColumnSchema } from '../types';
import StatusBadge from './StatusBadge.vue';
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-vue-next';

const props = defineProps<{
  items: any[];
  columns: ColumnSchema[];
}>();

const searchQuery = ref('');
const currentPage = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref<string>('');
const sortDesc = ref(false);

// Reset navigation on schema/items changes
watch(() => props.items, () => {
  currentPage.value = 1;
});

function handleSort(key: string) {
  if (sortBy.value === key) {
    if (!sortDesc.value) {
      sortDesc.value = true;
    } else {
      sortBy.value = '';
      sortDesc.value = false;
    }
  } else {
    sortBy.value = key;
    sortDesc.value = false;
  }
}

// Search and filter logic
const filteredItems = computed(() => {
  let list = [...props.items];

  // Apply search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter((item) => {
      return props.columns.some((col) => {
        const val = item[col.key];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }

  // Apply sorting
  if (sortBy.value) {
    const colKey = sortBy.value;
    const isDesc = sortDesc.value;
    const targetCol = props.columns.find((c) => c.key === colKey);
    const isNum = targetCol?.type === 'number';

    list.sort((a, b) => {
      const valA = a[colKey];
      const valB = b[colKey];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (isNum) {
        return isDesc ? (valB - valA) : (valA - valB);
      } else {
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return isDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
      }
    });
  }

  return list;
});

// Pagination calculations
const totalPages = computed(() => {
  const count = filteredItems.value.length;
  return Math.ceil(count / itemsPerPage.value) || 1;
});

const paginatedItems = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  const endIndex = startIndex + itemsPerPage.value;
  return filteredItems.value.slice(startIndex, endIndex);
});

const paginationText = computed(() => {
  const total = filteredItems.value.length;
  if (total === 0) return 'Tidak ada data';
  const start = (currentPage.value - 1) * itemsPerPage.value + 1;
  const end = Math.min(currentPage.value * itemsPerPage.value, total);
  return `Menampilkan ${start}-${end} dari ${total} total baris`;
});

function goPrev() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

function goNext() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

function resetFilters() {
  searchQuery.value = '';
  sortBy.value = '';
  sortDesc.value = false;
  currentPage.value = 1;
}
</script>

<template>
  <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
    <!-- Top toolbar filter/search -->
    <div class="p-4 border-b border-slate-100/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
      <div class="relative max-w-sm w-full">
        <span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
          <Search class="w-4 h-4" />
        </span>
        <input 
          id="table-search-input"
          v-model="searchQuery"
          type="search" 
          placeholder="Cari semua data di tabel..."
          class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
        />
      </div>

      <div class="flex items-center gap-3 self-end md:self-auto text-xs">
        <button 
          v-if="searchQuery || sortBy"
          id="btn-reset-filters"
          type="button"
          class="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          @click="resetFilters"
        >
          <RefreshCw class="w-3 h-3" />
          Reset Filter / Urutkan
        </button>
        <span class="text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded text-2xs uppercase tracking-tight">Real-Time Data</span>
      </div>
    </div>

    <!-- Responsive Table viewport -->
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-left text-xs text-slate-700">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-150 uppercase text-2xs tracking-wider text-slate-500 font-bold select-none">
            <th class="py-3 px-4 w-12 text-center">No</th>
            <!-- Column keys mapped -->
            <th 
              v-for="col in columns" 
              :key="col.key"
              class="py-3 px-4 font-semibold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
              @click="handleSort(col.key)"
            >
              <div class="flex items-center gap-1.5 whitespace-nowrap">
                {{ col.label }}
                <!-- Sort arrows -->
                <span class="text-slate-400">
                  <ChevronUp v-if="sortBy === col.key && !sortDesc" class="w-3.5 h-3.5 text-blue-600" />
                  <ChevronDown v-else-if="sortBy === col.key && sortDesc" class="w-3.5 h-3.5 text-blue-600" />
                  <span v-else class="opacity-0 group-hover:opacity-100 text-3xs">↕</span>
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="paginatedItems.length === 0" class="text-center bg-white">
            <td :colspan="columns.length + 1" class="py-12 px-4 text-slate-400">
              <p class="font-medium text-sm">Tidak ada data ditemukan</p>
              <p class="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian Anda atau unggah file baru.</p>
            </td>
          </tr>

          <!-- Rows rendered -->
          <tr 
            v-for="(item, idx) in paginatedItems" 
            :key="idx"
            class="transition-colors group hover:bg-slate-50/50"
            :class="item._invalid ? 'bg-rose-50/70 text-rose-910 hover:bg-rose-105' : 'bg-white'"
          >
            <!-- Index indicator -->
            <td class="py-3.5 px-4 text-center font-mono font-medium text-slate-400 text-2xs">
              <div v-if="item._invalid" class="flex items-center justify-center text-rose-600" title="Baris data error">
                <AlertCircle class="w-4 h-4 animation-bounce" />
              </div>
              <span v-else>{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</span>
            </td>

            <!-- Real cells -->
            <td 
              v-for="col in columns" 
              :key="col.key" 
              class="py-3.5 px-4 align-middle"
              :class="{
                'font-mono text-2xs tracking-normal font-medium': col.type === 'number' || col.type === 'time' || col.key === 'resi',
                'font-medium text-slate-900': col.key === 'courier' || col.key === 'nama'
              }"
            >
              <!-- Rendering dynamic elements based on column type -->
              <template v-if="col.type === 'status'">
                <StatusBadge :status="item[col.key]" />
              </template>
              
              <template v-else-if="col.key === 'urgency' || col.key === 'urgensitas'">
                <span 
                  class="font-semibold"
                  :class="item[col.key] === 'Sangat Penting' ? 'text-rose-600' : 'text-amber-600'"
                >
                  {{ item[col.key] }}
                </span>
              </template>

              <template v-else-if="col.key === 'rating'">
                <div class="flex items-center gap-0.5 text-amber-500 font-bold font-mono">
                  ★ <span class="text-slate-950 font-semibold">{{ item[col.key] }}</span>
                </div>
              </template>

              <template v-else>
                {{ item[col.key] }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    <div 
      v-if="totalPages > 1" 
      class="p-4 border-t border-slate-100 bg-slate-50/40 flex flex-row items-center justify-between text-xs font-semibold text-slate-600"
    >
      <span class="font-normal text-slate-500">{{ paginationText }}</span>

      <div class="flex items-center gap-2">
        <button 
          id="btn-prev-page"
          type="button" 
          class="p-2 border border-slate-200 rounded-lg hover:bg-white bg-slate-100/50 text-slate-550 transition disabled:opacity-40 disabled:hover:bg-slate-100/50 cursor-pointer"
          :disabled="currentPage === 1"
          @click="goPrev"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>

        <span class="px-3 py-1 font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg">
          Halaman {{ currentPage }} dari {{ totalPages }}
        </span>

        <button 
          id="btn-next-page"
          type="button" 
          class="p-2 border border-slate-200 rounded-lg hover:bg-white bg-slate-100/50 text-slate-550 transition disabled:opacity-40 disabled:hover:bg-slate-100/50 cursor-pointer"
          :disabled="currentPage === totalPages"
          @click="goNext"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-2xs {
  font-size: 0.65rem;
}
.text-3xs {
  font-size: 0.55rem;
}
.text-rose-910 {
  color: #881337;
}
.bg-rose-105 {
  background-color: #ffe4e6;
}
</style>
