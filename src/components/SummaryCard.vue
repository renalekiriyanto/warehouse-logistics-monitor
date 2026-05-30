<script setup lang="ts">
import { computed } from 'vue';
import { 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  Truck,
  Inbox,
  AlertTriangle,
  History,
  Timer,
  Users,
  CalendarDays
} from 'lucide-vue-next';

const props = defineProps<{
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  icon?: 'inbound' | 'projection' | 'expedite' | 'backlog' | 'std' | 'performance' | 'attendance' | 'sla';
}>();

const iconComponent = computed(() => {
  switch (props.icon) {
    case 'inbound':
      return Inbox;
    case 'projection':
      return CalendarDays;
    case 'expedite':
      return Timer;
    case 'backlog':
      return AlertTriangle;
    case 'std':
      return History;
    case 'performance':
      return Truck;
    case 'attendance':
      return Users;
    case 'sla':
      return TrendingUp;
    default:
      return Inbox;
  }
});

const trendColor = computed(() => {
  if (props.trendType === 'up') return 'text-emerald-600 bg-emerald-50';
  if (props.trendType === 'down') return 'text-rose-600 bg-rose-50';
  return 'text-slate-600 bg-slate-50';
});
</script>

<template>
  <div 
    :id="'kpi-' + title.toLowerCase().replace(/\s+/g, '-')"
    class="bg-white rounded-xl border border-slate-100 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
  >
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">{{ title }}</p>
        <div class="flex items-baseline gap-1">
          <h3 class="text-2xl font-bold text-slate-900 tracking-tight">{{ value }}</h3>
          <span v-if="unit" class="text-sm font-medium text-slate-500">{{ unit }}</span>
        </div>
      </div>
      <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600">
        <component :is="iconComponent" class="w-5 h-5" />
      </div>
    </div>
    
    <div class="mt-4 flex items-center justify-between">
      <span class="text-xs text-slate-500 font-medium line-clamp-1 pr-1">{{ subtitle || 'Diperbarui hari ini' }}</span>
      <span 
        v-if="trend" 
        class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-2xs font-semibold whitespace-nowrap shrink-0"
        :class="trendColor"
      >
        <component 
          :is="trendType === 'up' ? ArrowUpRight : (trendType === 'down' ? ArrowDownRight : TrendingUp)" 
          class="w-3 h-3" 
        />
        {{ trend }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.text-2xs {
  font-size: 0.65rem;
}
</style>
