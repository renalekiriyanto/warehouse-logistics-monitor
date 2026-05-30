<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLogisticsStore } from '../store/logisticsStore';
import { MenuKey } from '../types';
import { 
  ArrowLeft, Inbox, CalendarDays, Timer, AlertTriangle, History, Truck, Users 
} from 'lucide-vue-next';

// Import our new isolated, modular menu components
import InboundMenu from '../components/menus/InboundMenu.vue';
import ProjectionMenu from '../components/menus/ProjectionMenu.vue';
import ExpediteMenu from '../components/menus/ExpediteMenu.vue';
import BacklogMenu from '../components/menus/BacklogMenu.vue';
import StdMenu from '../components/menus/StdMenu.vue';
import PerformanceMenu from '../components/menus/PerformanceMenu.vue';
import AttendanceMenu from '../components/menus/AttendanceMenu.vue';

const route = useRoute();
const router = useRouter();
const store = useLogisticsStore();

// Watch for route param change
const menuKey = computed(() => (route.params.menuKey as MenuKey) || 'inbound');

// Header, description and KPI mappings for the views
const menuMeta = computed(() => {
  const k = menuKey.value;
  switch (k) {
    case 'inbound':
      return {
        title: '1. Cutoff Inbound Logistik',
        desc: 'Pemantauan penerimaan barang masuk ke gudang logistik dan hub secara aktif.',
        icon: Inbox,
        kpiLabel: 'Total Inbound',
        kpiVal: store.inbound.length + ' paket',
        trendText: `Total Berat: ${store.totalInboundWeight} Kg`
      };
    case 'projection':
      return {
        title: '2. Proyeksi Pengiriman (Forecasting)',
        desc: 'Sistem peramalan estimasi volume cargo dan alokasi gudang hari mendatang.',
        icon: CalendarDays,
        kpiLabel: 'Total Proyeksi',
        kpiVal: store.totalProjectionVolume + ' unit volume',
        trendText: 'Kapasitas Kargo'
      };
    case 'expedite':
      return {
        title: '3. Expedite Parcel',
        desc: 'Pemantauan paket prioritas tinggi/ekonomis kilat dengan batas waktu deadline ketat.',
        icon: Timer,
        kpiLabel: 'Expedite Pending',
        kpiVal: store.expedite.filter(x => x.status === 'pending').length + ' paket',
        trendText: 'Kirim Instan'
      };
    case 'backlog':
      return {
        title: '4. Backlog Operasional',
        desc: 'Daftar penumpukan paket akibat kendala alamat, penerima kosong, atau rute bermasalah.',
        icon: AlertTriangle,
        kpiLabel: 'Backlog Aktif',
        kpiVal: store.backlog.length + ' item',
        trendText: `Rata-rata: ${store.backlog.length > 0 ? (store.totalBacklogDays / store.backlog.length).toFixed(1) : 0} hari`
      };
    case 'std':
      return {
        title: '5. Laporan Harian STD',
        desc: 'Pemantauan sisa antrean paket dan target standard delivery per masing-masing kurir.',
        icon: History,
        kpiLabel: 'Belum Selesai',
        kpiVal: store.stdIncompleteCouriers.length + ' kurir',
        trendText: 'Sisa Antrean'
      };
    case 'performance':
      return {
        title: '6. Performa & SLA Kurir',
        desc: 'Penilaian kepatuhan SLA logistik dan rating keberhasilan antaran per individu kurir.',
        icon: Truck,
        kpiLabel: 'Overall SLA',
        kpiVal: store.overallCourierSla + '%',
        trendText: `Rating Rata-rata: ⭐ ${store.courierAverageRating}`
      };
    case 'attendance':
      return {
        title: '7. Absensi & Kehadiran Kurir',
        desc: 'Pencatatan shift masuk, absensi staff, dan jam check-in kurir lapangan.',
        icon: Users,
        kpiLabel: 'Rasio Kehadiran',
        kpiVal: store.attendanceRate + '%',
        trendText: 'Shift Lapangan'
      };
    default:
      return {
        title: 'Manajer Logistik',
        desc: 'Logistics WMS monitoring portal.',
        icon: Inbox,
        kpiLabel: 'Total Data',
        kpiVal: '0',
        trendText: '-'
      };
  }
});
</script>

<template>
  <div id="menu-view" class="space-y-6 pb-12 animate-fade-in animate-duration-300">
    <!-- Back Header Navigation Line -->
    <div class="flex items-center gap-3">
      <button 
        id="btn-back-dashboard"
        type="button" 
        class="inline-flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
        title="Kembali ke dasbor utama"
        @click="router.push('/')"
      >
        <ArrowLeft class="w-4 h-4 text-slate-600" />
      </button>

      <div>
        <h1 class="text-sm font-semibold text-slate-500">Logistics WMS Hub</h1>
        <h2 class="text-xl font-bold text-slate-900 tracking-tight mt-0.5">{{ menuMeta.title }}</h2>
      </div>
    </div>

    <!-- Explanation card and quick indicators -->
    <div class="bg-white border border-slate-100 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <component :is="menuMeta.icon" class="w-5 h-5" />
        </div>
        <div>
          <p class="text-xs text-slate-600 leading-relaxed max-w-2xl">{{ menuMeta.desc }}</p>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-3xs font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded tracking-widest uppercase mb-0.5">
              Metodologi Unggah: REST API & Berkas CSV
            </span>
            <span class="text-3xs font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded tracking-widest uppercase mb-0.5">Dual-Mode</span>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Counter -->
      <div class="bg-slate-900 text-white rounded-lg p-3 w-48 text-center shrink-0 border border-slate-950 shadow-3xs relative overflow-hidden">
        <div class="absolute -right-6 -bottom-6 w-12 h-12 bg-blue-500/10 rounded-full"></div>
        <p class="text-3xs font-bold font-sans uppercase tracking-widest text-[9px] text-blue-300 leading-none">{{ menuMeta.kpiLabel }}</p>
        <p class="text-lg font-bold tracking-tight mt-1 leading-none font-mono">{{ menuMeta.kpiVal }}</p>
        <p class="text-3xs font-semibold text-blue-200 mt-1.5 leading-none">{{ menuMeta.trendText }}</p>
      </div>
    </div>

    <!-- Isolated Content Component Router Wrapper depending on active menu selection -->
    <div class="mt-4">
      <InboundMenu v-if="menuKey === 'inbound'" />
      <ProjectionMenu v-else-if="menuKey === 'projection'" />
      <ExpediteMenu v-else-if="menuKey === 'expedite'" />
      <BacklogMenu v-else-if="menuKey === 'backlog'" />
      <StdMenu v-else-if="menuKey === 'std'" />
      <PerformanceMenu v-else-if="menuKey === 'performance'" />
      <AttendanceMenu v-else-if="menuKey === 'attendance'" />
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
