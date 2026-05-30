<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLogisticsStore } from '../store/logisticsStore';
import SummaryCard from '../components/SummaryCard.vue';
import WhatsAppReportGenerator from '../components/WhatsAppReportGenerator.vue';
import { 
  AlertTriangle, 
  Trash2, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  History, 
  ChevronRight, 
  Sparkles,
  RefreshCw,
  Award
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const store = useLogisticsStore();
const router = useRouter();

// Active alerts list
const activeAlerts = computed(() => store.alerts);

// Activity logs slice
const recentLogs = computed(() => store.logs.slice(0, 5));

function removeAlert(id: string) {
  store.clearAlert(id);
}

function navigateToMenu(menuKey: string) {
  router.push(`/menu/${menuKey}`);
}

// Sparkle/Rating commentary based on courier statistics
const statusPerformanceTip = computed(() => {
  const sla = store.overallCourierSla;
  if (sla >= 95) return 'Sangat Prima: Seluruh kurir mematuhi timeline SLA dengan performa optimal.';
  if (sla >= 90) return 'Stabil: Operasional berjalan baik dengan angka kegagalan rendah.';
  return 'Perhatian: SLA di bawah 90%, koordinasikan kurir dengan backlog berlebih.';
});

const todayDateFormatted = computed(() => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('id-ID', options);
});
</script>

<template>
  <div id="dashboard-view" class="space-y-6 pb-12 animate-fade-in">
    <!-- Top Greeting Banner -->
    <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-md relative overflow-hidden">
      <div class="absolute -right-12 -bottom-12 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl"></div>
      <div class="absolute right-12 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-xl"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/20 uppercase tracking-widest">
            <Sparkles class="w-3 h-3 text-blue-400" />
            Live Warehousing Monitor
          </span>
          <h2 class="text-xl md:text-2xl font-bold mt-2.5 tracking-tight">Halo, Pak Budi!</h2>
          <p class="text-xs text-slate-300/85 mt-1 max-w-xl leading-relaxed">
            Selamat datang kembali di panel monitoring expedisi. Data di bawah dikompilasi secara real-time dari data CSV manual dan performa kurir harian.
          </p>
        </div>

        <div class="text-left md:text-right shrink-0">
          <p class="text-2xs font-bold text-blue-400 uppercase tracking-widest font-mono">Hari Ini:</p>
          <p class="text-xs font-bold text-white mt-1 font-mono uppercase tracking-tight">{{ todayDateFormatted }}</p>
          <p class="text-2xs text-slate-400/85 mt-0.5">Shift Kerja Terpantau: Pagi & Siang</p>
        </div>
      </div>
    </div>

    <!-- MAIN KPI METRIC SECTION GRID-->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <SummaryCard 
        title="1. TOTAL INBOUND" 
        :value="store.totalInboundCount" 
        unit="parcels"
        :subtitle="`Akumulasi Berat: ${store.totalInboundWeight} Kg`"
        trend="+14%"
        trendType="up"
        icon="inbound"
        @click="navigateToMenu('inbound')"
        class="cursor-pointer"
      />
      <SummaryCard 
        title="2. PROYEKSI VOLUM" 
        :value="store.totalProjectionVolume" 
        unit="pcs expected"
        subtitle="Forecasting 5 hari depan"
        trend="Stabil"
        trendType="neutral"
        icon="projection"
        @click="navigateToMenu('projection')"
        class="cursor-pointer"
      />
      <SummaryCard 
        title="3. EXPEDITE PRIORITAS" 
        :value="store.expeditePriorityPending" 
        unit="urgent pending"
        subtitle="Batas kirim <24 jam"
        trend="Priority"
        trendType="down"
        icon="expedite"
        @click="navigateToMenu('expedite')"
        class="cursor-pointer"
      />
      <SummaryCard 
        title="4. AKUMULASI BACKLOG" 
        :value="store.backlog.length" 
        unit="bottlenecks"
        :subtitle="`Total keterlambatan: ${store.totalBacklogDays} hari`"
        :trend="store.backlog.length > 3 ? 'High' : 'Low'"
        :trendType="store.backlog.length > 3 ? 'down' : 'up'"
        icon="backlog"
        @click="navigateToMenu('backlog')"
        class="cursor-pointer"
      />
      <SummaryCard 
        title="5. COURIER SLA RATE" 
        :value="store.overallCourierSla" 
        unit="%"
        :subtitle="statusPerformanceTip"
        trend="⭐ 4.6"
        trendType="up"
        icon="sla"
        @click="navigateToMenu('performance')"
        class="cursor-pointer"
      />
      <SummaryCard 
        title="6. ABSENSI REKAPITULASI" 
        :value="store.attendanceRate" 
        unit="%"
        :subtitle="`Kehadiran: ${store.attendance.filter(a => a.status === 'Hadir').length}/${store.attendance.length} Staff`"
        trend="Hadir"
        trendType="up"
        icon="attendance"
        @click="navigateToMenu('attendance')"
        class="cursor-pointer"
      />
      <SummaryCard 
        title="7. PERFORMANCE RATINGS" 
        :value="store.courierAverageRating" 
        unit="avg rating"
        subtitle="Berdasarkan 5 kurir aktif"
        trend="Excellent"
        trendType="up"
        icon="performance"
        @click="navigateToMenu('performance')"
        class="cursor-pointer animate-pulse"
      />
      <SummaryCard 
        title="8. STATUS ANTALAN" 
        :value="store.std.length" 
        unit="STD items"
        subtitle="Standard Delivery Assigned"
        trend="Listed"
        trendType="neutral"
        icon="std"
        @click="navigateToMenu('std')"
        class="cursor-pointer"
      />
    </div>

    <!-- CHANNELS: ALERTS & CHARTS WORKSPACE FLUID GRID-->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Operational Charts Column: Spans 2 blocks -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Dashboard Chart 1: Daily Area and Bar projection chart -->
        <div class="bg-white border border-slate-150 p-5 rounded-2xl shadow-3xs">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
               <h3 class="text-sm font-bold text-slate-800">Histogram Proyeksi Pengiriman Mingguan</h3>
              <p class="text-xs text-slate-500">Estimasi volume cargo dalam satuan pcs berdasarkan data projection.</p>
            </div>
            <span class="text-2xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase">Forecast</span>
          </div>

          <!-- Pure SVG Custom Chart with clean tooltips -->
          <div class="w-full h-56 mt-2 relative">
            <svg class="w-full h-full" viewBox="0 0 600 220" preserveAspectRatio="none">
              <!-- Grid Lines -->
              <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" stroke-width="1" />
              <line x1="40" y1="70" x2="580" y2="70" stroke="#f1f5f9" stroke-width="1" />
              <line x1="40" y1="120" x2="580" y2="120" stroke="#f1f5f9" stroke-width="1" />
              <line x1="40" y1="170" x2="580" y2="170" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2" />

              <!-- Y-Axis Labels -->
              <text x="10" y="25" class="text-2xs font-mono fill-slate-400" text-anchor="start">4k pcs</text>
              <text x="10" y="75" class="text-2xs font-mono fill-slate-400" text-anchor="start">2.5k pcs</text>
              <text x="10" y="125" class="text-2xs font-mono fill-slate-400" text-anchor="start">1k pcs</text>
              <text x="10" y="175" class="text-2xs font-mono fill-slate-400" text-anchor="start">0</text>

              <!-- Projection Bars (Volume column projections mapped) -->
              <!-- May 30: 1800 (height scale 1800/4000 = 45% -> 170 - 75 = 95px height) -->
              <rect x="75" y="102.5" width="28" height="67.5" fill="#f0fdf4" rx="4" class="hover:fill-emerald-250 transition-colors cursor-pointer" />
              <!-- May 31: 3400 (height scale 3400/4000 = 85% -> 170 - 127 = 43px height) -->
              <rect x="175" y="42.5" width="28" height="127.5" fill="#bae6fd" rx="4" class="hover:fill-blue-300 transition-colors cursor-pointer" />
              <!-- June 1: 1200 (scale 30%) -->
              <rect x="275" y="125" width="28" height="45" fill="#e0f2fe" rx="4" class="hover:fill-blue-300 transition-colors cursor-pointer" />
              <!-- June 2: 2200 (scale 55%) -->
              <rect x="375" y="87.5" width="28" height="82.5" fill="#bae6fd" rx="4" class="hover:fill-blue-300 transition-colors cursor-pointer" />
              <!-- June 3: 1500 (scale 37%) -->
              <rect x="475" y="113.7" width="28" height="56.3" fill="#e0f2fe" rx="4" class="hover:fill-blue-300 transition-colors cursor-pointer" />

              <!-- Polyline Overlay Trends representing current historical patterns -->
              <polyline 
                fill="none" 
                stroke="#2563eb" 
                stroke-width="2.5" 
                stroke-linecap="round"
                stroke-linejoin="round"
                points="89,120 189,60 289,140 389,95 489,125" 
              />
              
              <!-- Data Nodes -->
              <circle cx="89" cy="120" r="4.5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" class="cursor-pointer" />
              <circle cx="189" cy="60" r="4.5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" class="cursor-pointer" />
              <circle cx="289" cy="140" r="4.5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" class="cursor-pointer" />
              <circle cx="389" cy="95" r="4.5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" class="cursor-pointer" />
              <circle cx="489" cy="125" r="4.5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" class="cursor-pointer" />

              <!-- X-Axis Labels -->
              <text x="89" y="195" class="text-3xs font-semibold font-sans fill-slate-500" text-anchor="middle">30 Mei (Hari Ini)</text>
              <text x="189" y="195" class="text-3xs font-semibold font-sans fill-slate-500" text-anchor="middle">31 Mei (Besok)</text>
              <text x="289" y="195" class="text-3xs font-semibold font-sans fill-slate-500" text-anchor="middle">01 Jun</text>
              <text x="389" y="195" class="text-3xs font-semibold font-sans fill-slate-500" text-anchor="middle">02 Jun</text>
              <text x="489" y="195" class="text-3xs font-semibold font-sans fill-slate-500" text-anchor="middle">03 Jun</text>
            </svg>
            <div class="absolute bottom-1 right-2 flex items-center gap-4 text-3xs font-bold text-slate-500">
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-blue-200 border border-blue-300 rounded"></span> Volum Esok</span>
              <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-blue-500 inline-block"></span> Trend Aktual</span>
            </div>
          </div>
        </div>

        <!-- Dashboard Chart 2: Active Courier SLA & loading tracker bar charts -->
        <div class="bg-white border border-slate-150 p-5 rounded-2xl shadow-3xs">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 class="text-sm font-bold text-slate-800">SLA & Progres Pengiriman Standard (STD) per Kurir</h3>
              <p class="text-xs text-slate-500">Angka kepatuhan logistik dan volume pengantaran selesai versus pending harian.</p>
            </div>
            <div class="flex items-center gap-1 bg-yellow-50 text-amber-700 font-bold border border-yellow-200 px-2 py-0.5 rounded text-2xs uppercase">
              <Award class="w-3 h-3 text-amber-600" /> TOP RATED
            </div>
          </div>

          <div class="space-y-4">
            <div v-for="c in store.std" :key="c.resi" class="relative group">
              <div class="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1 leading-none">
                <span class="font-bold flex items-center gap-1">
                  {{ c.courier }} 
                  <span class="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Resi {{ c.resi }}</span>
                </span>
                <span class="font-mono text-slate-500 text-2xs">
                  Diselesaikan: {{ c.completed }} / {{ c.target }} <span class="font-bold text-slate-850">({{ Math.round((c.completed / c.target) * 100) }}%)</span>
                </span>
              </div>
              
              <!-- Progressive loading bar slider -->
              <div class="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  class="bg-emerald-500 h-full transition-all duration-300"
                  :style="{ width: `${(c.completed / c.target) * 100}%` }"
                  title="Selesai"
                ></div>
                <div 
                  class="bg-amber-400 h-full transition-all duration-300"
                  :style="{ width: `${(c.pending / c.target) * 100}%` }"
                  title="Pending"
                ></div>
              </div>

              <!-- Status markers -->
              <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-1">
                <span v-if="c.pending > 0" class="text-amber-600 flex items-center gap-0.5">⚠️ Masih ada {{ c.pending }} paket pending</span>
                <span v-else class="text-emerald-600 font-semibold">✅ Selesai 100%</span>
                <span class="font-mono">{{ c.completed === c.target ? 'PERFEKT SLA' : 'ON PROGRESS' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Operational Alerts & Recent uploads (Spans 1 block) -->
      <div class="space-y-6">
        <!-- Actionable Active Alerts Card -->
        <div class="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle class="w-4 h-4 text-amber-500" />
              Notifikasi Isu Hambatan ({{ activeAlerts.length }})
            </h3>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded text-rose-600 bg-rose-50 border border-rose-100 animate-pulse">WAR ROOM</span>
          </div>

          <div v-if="activeAlerts.length === 0" class="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div class="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
              <CheckCircle class="w-5 h-5" />
            </div>
            <p class="text-xs font-bold text-slate-800">Clear! Seluruh Operasi Normal</p>
            <p class="text-2xs text-slate-500 mt-0.5 max-w-xs">Tidak ada lonjakan backlog atau antrean pengiriman kritis.</p>
          </div>

          <div v-else class="space-y-3 max-h-80 overflow-y-auto pr-1">
            <div 
              v-for="alert in activeAlerts" 
              :key="alert.id" 
              class="p-3 border rounded-xl flex gap-2.5 relative group hover:border-slate-300 transition-colors"
              :class="alert.severity === 'high' 
                ? 'bg-rose-50/40 border-rose-100 text-rose-950' 
                : (alert.severity === 'medium' ? 'bg-amber-50/40 border-amber-100 text-amber-950' : 'bg-slate-50 border-slate-205 text-slate-800')"
            >
              <div 
                class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border text-xs"
                :class="alert.severity === 'high' 
                  ? 'bg-rose-100 border-rose-200 text-rose-700' 
                  : (alert.severity === 'medium' ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-600')"
              >
                <component 
                  :is="alert.severity === 'high' ? ShieldAlert : AlertTriangle" 
                  class="w-4 h-4" 
                />
              </div>

              <div class="flex-1 select-none pr-6">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold leading-none">{{ alert.title }}</h4>
                  <span class="text-[10px] text-slate-400 font-mono flex items-center gap-0.5 leading-none bg-white border border-slate-150 rounded px-1">{{ alert.time }}</span>
                </div>
                <p class="text-2xs text-slate-600 mt-1.5 leading-normal">{{ alert.message }}</p>
              </div>

              <!-- Delete handle -->
              <button 
                id="btn-dismiss-alert"
                type="button"
                class="absolute right-2 top-2 p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                title="Tandai selesai / abaikan"
                @click="removeAlert(alert.id)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Activity Audit Logging history -->
        <div class="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <History class="w-4 h-4 text-blue-500" />
              Log Histori Sinkronisasi Upload
            </h3>
            <span class="text-[10px] text-slate-500 font-semibold">5 Log Terkini</span>
          </div>

          <div class="space-y-3.5 max-h-72 overflow-y-auto">
            <div v-for="log in recentLogs" :key="log.id" class="flex gap-3 text-2xs leading-normal">
              <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
              <div class="flex-1">
                <p class="font-bold text-slate-850 leading-tight">{{ log.action }}</p>
                <p class="text-3xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>{{ log.timestamp }}</span>
                  <span>•</span>
                  <span>Modul: <b class="text-slate-600 font-medium">{{ log.menu }}</b></span>
                </p>
                <span v-if="log.rowsCount > 0" class="inline-block text-3xs font-semibold px-1 rounded bg-slate-100 text-slate-500 mt-1.5">
                  {{ log.rowsCount }} baris data divalidasi
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- WHATSAPP AUTOMATION REPORT SYSTEM AREA -->
    <div id="wa-report-generator-layout" class="grid grid-cols-1 gap-6">
      <WhatsAppReportGenerator />
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
.bg-indigo-250 {
  background-color: #c7d2fe;
}
.border-slate-205 {
  border-color: #cbd5e1;
}
</style>
