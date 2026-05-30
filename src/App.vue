<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
import Header from './components/Header.vue';

const route = useRoute();
const mobileSidebarOpen = ref(false);

const activePageHeaderTitle = computed(() => {
  if (route.path === '/') return 'Dasbor Pemantauan Gudang';
  
  const menuParam = route.params.menuKey as string;
  if (!menuParam) return 'Warehouse Logistics Portal';

  switch (menuParam) {
    case 'inbound':
      return 'Inbound Monitor';
    case 'projection':
      return 'Volume Projection Forecast';
    case 'expedite':
      return 'Expedite Priority Dispatch';
    case 'backlog':
      return 'Backlog Issues Management';
    case 'std':
      return 'SLA STD Deliveries';
    case 'performance':
      return 'Courier SLA Performance Card';
    case 'attendance':
      return 'Attendance Tracker';
    default:
      return 'Warehouse logistics Portal';
  }
});
</script>

<template>
  <div id="wms-app-layout" class="min-h-screen flex bg-slate-50 text-slate-850 font-sans antialiased">
    <!-- Sidebar navigation -->
    <Sidebar 
      :mobile-open="mobileSidebarOpen" 
      @close-mobile="mobileSidebarOpen = false" 
    />

    <!-- Main screen frame container -->
    <div class="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
      <Header 
        :title="activePageHeaderTitle" 
        @toggle-mobile="mobileSidebarOpen = !mobileSidebarOpen" 
      />

      <!-- Content viewport panel with soft fade transitions -->
      <main class="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade-page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style>
/* CSS transition definitions for router-view fading */
.fade-page-enter-active,
.fade-page-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.fade-page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
