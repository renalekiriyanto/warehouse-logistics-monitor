<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 
  LayoutDashboard, 
  Inbox, 
  CalendarDays, 
  Timer, 
  AlertTriangle, 
  History, 
  Truck, 
  Users, 
  Warehouse,
  Menu,
  X
} from 'lucide-vue-next';
import { MenuKey } from '../types';

const props = defineProps<{
  mobileOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close-mobile'): void;
}>();

const route = useRoute();
const router = useRouter();

const navItems = [
  { path: '/', label: 'Dasbor Utama', icon: LayoutDashboard, key: 'dashboard' },
  { path: '/menu/inbound', label: '1. Inbound', icon: Inbox, key: 'inbound' },
  { path: '/menu/projection', label: '2. Projection', icon: CalendarDays, key: 'projection' },
  { path: '/menu/expedite', label: '3. Expedite Parcel', icon: Timer, key: 'expedite' },
  { path: '/menu/backlog', label: '4. Backlog', icon: AlertTriangle, key: 'backlog' },
  { path: '/menu/std', label: '5. STD/Sameday Delivered', icon: History, key: 'std' },
  { path: '/menu/performance', label: '6. Performa Kurir', icon: Truck, key: 'performance' },
  { path: '/menu/attendance', label: '7. Absensi Kurir', icon: Users, key: 'attendance' },
];

const currentRoutePath = computed(() => route.path);

function navigateTo(path: string) {
  router.push(path);
  emit('close-mobile');
}
</script>

<template>
  <div>
    <!-- Desktop Sidebar (md and above) -->
    <aside id="sidebar-desktop" class="hidden md:flex flex-col w-64 h-screen bg-slate-900 border-r border-slate-800 text-slate-300 shrink-0 sticky top-0">
      <!-- Title banner logo -->
      <div class="px-6 py-5.5 border-b border-slate-800 flex items-center gap-2 bg-slate-950/40">
        <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
          <Warehouse class="w-4 h-4" />
        </div>
        <div>
          <h1 class="text-xs font-bold text-white tracking-wider uppercase leading-none">WMS Logistik</h1>
          <p class="text-[10px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">Expedition Portal</p>
        </div>
      </div>

      <!-- Navigation link list -->
      <nav class="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <button 
          v-for="item in navItems" 
          :key="item.path"
          :id="'nav-desktop-' + item.key"
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer relative"
          :class="currentRoutePath === item.path 
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10 border-l-4 border-blue-400' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'"
          @click="navigateTo(item.path)"
        >
          <component :is="item.icon" class="w-4 h-4" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <!-- System profile footline -->
      <div class="p-4 border-t border-slate-800 text-2xs text-slate-500 flex items-center gap-2 bg-slate-950/20">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        <span class="font-mono text-[10px]">WMS PWA v1.2 • Offline Ready</span>
      </div>
    </aside>

    <!-- Mobile Slideover Drawer (Overlay on touch) -->
    <div 
      v-if="mobileOpen"
      id="sidebar-mobile-backdrop"
      class="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
      @click="emit('close-mobile')"
    ></div>

    <aside 
      id="sidebar-mobile"
      class="fixed top-0 left-0 bottom-0 w-64 bg-slate-900 text-slate-300 z-50 md:hidden flex flex-col justify-between transition-transform duration-300 shadow-2xl border-r border-slate-800"
      :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div>
        <div class="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Warehouse class="w-4 h-4" />
            </div>
            <div>
              <h1 class="text-xs font-bold text-white uppercase leading-none">WMS Logistik</h1>
              <p class="text-[9px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Expedition Portal</p>
            </div>
          </div>

          <button id="btn-close-sidebar-mobile" class="p-1 rounded text-slate-400 hover:text-white" @click="emit('close-mobile')">
            <X class="w-5 h-5" />
          </button>
        </div>

        <nav class="px-4 py-6 space-y-1">
          <button 
            v-for="item in navItems" 
            :key="item.path"
            :id="'nav-mobile-' + item.key"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer"
            :class="currentRoutePath === item.path 
              ? 'bg-blue-600 text-white border-l-4 border-blue-400' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'"
            @click="navigateTo(item.path)"
          >
            <component :is="item.icon" class="w-4 h-4" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </div>

      <div class="p-4 border-t border-slate-800 text-xs text-slate-500 font-mono flex items-center gap-2 bg-slate-950/20">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>PWA v1.2 • Offline</span>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.py-5\.5 {
  padding-top: 1.35rem;
  padding-bottom: 1.35rem;
}
.text-2xs {
  font-size: 0.65rem;
}
</style>
