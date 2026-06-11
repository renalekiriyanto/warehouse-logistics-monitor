<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: string;
}>();

/**
 * Maps delivery and other app statuses to corresponding custom CSS badge class names based on user requirements.
 */
function getStatusBadgeClass(status: string): string {
  const s = String(status || '').trim().toLowerCase();
  
  switch (s) {
    case 'delivering':
      return 'badge-warning';
    
    case 'onhold':
    case 'on hold':
    case 'on_hold':
    case 'delayed':
    case 'alpa':
    case 'gagal':
    case 'sangat penting':
      return 'badge-danger';
    
    case 'delivered':
    case 'completed':
    case 'berhasil':
    case 'hadir':
      return 'badge-success';
    
    case 'lmhub_received':
    case 'lmhub-received':
      return 'badge-info';
    
    case 'lmhub_assigned':
    case 'lmhub-assigned':
    case 'assigned':
      return 'badge-primary';
    
    case 'lmhub_assigning':
    case 'lmhub-assigning':
    case 'assigning':
    case 'pending':
    case 'pagi':
      return 'badge-secondary';
    
    case 'return_lmhub_packed':
    case 'return-lmhub-packed':
    case 'packed':
      return 'badge-dark';
    
    default:
      return 'badge-light text-dark';
  }
}

const computedBadgeClass = computed(() => {
  return getStatusBadgeClass(props.status);
});

const labelText = computed(() => {
  const s = props.status || '';
  return s.charAt(0).toUpperCase() + s.slice(1);
});
</script>

<template>
  <span
    :id="'badge-' + status"
    class="badge rounded-pill font-weight-medium transition shadow-3xs"
    :class="computedBadgeClass"
  >
    <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-75"></span>
    {{ labelText }}
  </span>
</template>

