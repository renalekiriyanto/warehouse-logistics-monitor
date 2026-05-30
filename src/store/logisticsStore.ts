import { defineStore } from 'pinia';
import { 
  InboundData, 
  ProjectionData, 
  ExpediteData, 
  BacklogData, 
  StdData, 
  PerformanceData, 
  AttendanceData, 
  OperationalAlert, 
  ActivityLog, 
  MenuKey 
} from '../types';

// Helper to load state from localStorage or fallback
function getLocalItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to store state locally', e);
  }
}

// STUNNING PRELOADED DUMMY DATA FOR PRODUCTION FEEL
const INITIAL_INBOUND: InboundData[] = [
  { resi: 'RESI210389', sender: 'Tokopedia HQ', receiver: 'Eka Lestari', destination: 'South Jakarta', weight: 1.2, courier: 'Andi', status: 'completed' },
  { resi: 'RESI992019', sender: 'Shopee Hub', receiver: 'Hadi Prasetyo', destination: 'North Islet', weight: 4.8, courier: 'Budi', status: 'pending' },
  { resi: 'RESI773612', sender: 'Blibli Warehouse', receiver: 'Cynthia Tan', destination: 'Tangerang', weight: 15.0, courier: 'Citra', status: 'delayed' },
  { resi: 'RESI302912', sender: 'Zalora Center', receiver: 'Farhan Azis', destination: 'Depok', weight: 2.3, courier: 'Dedi', status: 'completed' },
  { resi: 'RESI552109', sender: 'Bukalapak Merchant', receiver: 'Gita Safitri', destination: 'Bogor', weight: 0.8, courier: 'Elena', status: 'pending' },
  { resi: 'RESI881023', sender: 'Sasa Co', receiver: 'Imanuel Putera', destination: 'West Jakarta', weight: 18.5, courier: 'Andi', status: 'completed' },
  { resi: 'RESI129841', sender: 'Minyak Kayu Putih', receiver: 'Keke A.', destination: 'Bekasi', weight: 3.0, courier: 'Budi', status: 'pending' },
  { resi: 'RESI410928', sender: 'Astra Spareparts', receiver: 'Workshop Auto', destination: 'Cikarang', weight: 24.0, courier: 'Citra', status: 'completed' },
];

const INITIAL_PROJECTION: ProjectionData[] = [
  { date: '2026-05-30', volume: 1800, category: 'Elektronik & Gadget', origin: 'Cikarang Hub', pic: 'Dwi Siswoko', status: 'priority' },
  { date: '2026-05-31', volume: 3400, category: 'Fast Moving Consumer Goods', origin: 'Tangerang DC', pic: 'Siti Rahma', status: 'pending' },
  { date: '2026-06-01', volume: 1200, category: 'Fashion & Kosmetik', origin: 'BandungDC', pic: 'Agus Prayogo', status: 'pending' },
  { date: '2026-06-02', volume: 2200, category: 'Automotive Parts', origin: 'Karawang DC', pic: 'Roni Suhendra', status: 'priority' },
  { date: '2026-06-03', volume: 1500, category: 'Alat Olahraga', origin: 'Semarang DC', pic: 'Yani Mulyani', status: 'pending' },
];

const INITIAL_EXPEDITE: ExpediteData[] = [
  { resi: 'EXP-88910', itemName: 'Spesimen Medis ColdChain', deadline: '2026-05-30 14:00', courier: 'Citra', urgency: 'Sangat Penting', status: 'pending' },
  { resi: 'EXP-10292', itemName: 'Sertifikat Tanah Asli', deadline: '2026-05-30 15:30', courier: 'Andi', urgency: 'Sangat Penting', status: 'completed' },
  { resi: 'EXP-33821', itemName: 'Baterai Pengganti Server', deadline: '2026-05-30 18:00', courier: 'Budi', urgency: 'Penting', status: 'pending' },
  { resi: 'EXP-55392', itemName: 'Dokumen Tender Proyek', deadline: '2026-05-31 09:30', courier: 'Dedi', urgency: 'Sangat Penting', status: 'pending' },
];

const INITIAL_BACKLOG: BacklogData[] = [
  { resi: 'RESI773612', days: 5, reason: 'Alamat Penerima Kurang Jelas (RT/RW Lewat)', courier: 'Citra', status: 'delayed' },
  { resi: 'RESI881112', days: 3, reason: 'Penerima Sedang Mudik Luar Kantor', courier: 'Elena', status: 'delayed' },
  { resi: 'RESI992201', days: 4, reason: 'Kontak Penerima Tidak Bisa Dihubungi', courier: 'Andi', status: 'delayed' },
];

const INITIAL_STD: StdData[] = [
  { resi: 'RESI-STD-101', courier: 'Andi', target: 12, completed: 8, pending: 4, status: 'pending' },
  { resi: 'RESI-STD-102', courier: 'Budi', target: 5, completed: 3, pending: 2, status: 'pending' },
  { resi: 'RESI-STD-103', courier: 'Citra', target: 8, completed: 6, pending: 2, status: 'pending' },
  { resi: 'RESI-STD-104', courier: 'Dedi', target: 15, completed: 15, pending: 0, status: 'completed' },
  { resi: 'RESI-STD-105', courier: 'Elena', target: 10, completed: 10, pending: 0, status: 'completed' },
];

const INITIAL_PERFORMANCE: PerformanceData[] = [
  { courier: 'Andi', deliveries: 154, success: 145, failed: 9, rating: 4.8, status: 'completed' },
  { courier: 'Budi', deliveries: 128, success: 120, failed: 8, rating: 4.5, status: 'completed' },
  { courier: 'Citra', deliveries: 135, success: 125, failed: 10, rating: 4.2, status: 'delayed' },
  { courier: 'Dedi', deliveries: 160, success: 158, failed: 2, rating: 4.9, status: 'completed' },
  { courier: 'Elena', deliveries: 110, success: 108, failed: 2, rating: 4.7, status: 'completed' },
];

const INITIAL_ATTENDANCE: AttendanceData[] = [
  { courier: 'Andi', date: '2026-05-30', shift: 'Pagi', checkIn: '07:15', status: 'Hadir' },
  { courier: 'Budi', date: '2026-05-30', shift: 'Pagi', checkIn: '07:30', status: 'Hadir' },
  { courier: 'Citra', date: '2026-05-30', shift: 'Pagi', checkIn: '07:44', status: 'Hadir' },
  { courier: 'Dedi', date: '2026-05-30', shift: 'Siang', checkIn: '13:02', status: 'Hadir' },
  { courier: 'Elena', date: '2026-05-30', shift: 'Pagi', checkIn: '07:58', status: 'Hadir' },
  { courier: 'Fahri', date: '2026-05-30', shift: 'Malam', checkIn: '--:--', status: 'Izin' },
];

export const useLogisticsStore = defineStore('logistics', {
  state: () => ({
    // Core data lists
    inbound: getLocalItem<InboundData[]>('logistics_inbound', INITIAL_INBOUND),
    projection: getLocalItem<ProjectionData[]>('logistics_projection', INITIAL_PROJECTION),
    expedite: getLocalItem<ExpediteData[]>('logistics_expedite', INITIAL_EXPEDITE),
    backlog: getLocalItem<BacklogData[]>('logistics_backlog', INITIAL_BACKLOG),
    std: getLocalItem<StdData[]>('logistics_std', INITIAL_STD),
    performance: getLocalItem<PerformanceData[]>('logistics_performance', INITIAL_PERFORMANCE),
    attendance: getLocalItem<AttendanceData[]>('logistics_attendance', INITIAL_ATTENDANCE),

    // Activity Logs
    logs: getLocalItem<ActivityLog[]>('logistics_logs', [
      { id: 'log1', action: 'Inisialisasi Sistem', menu: 'Sistem', timestamp: '2026-05-30 08:00', rowsCount: 0 },
      { id: 'log2', action: 'Upload Data Inbound Manual', menu: 'Inbound', timestamp: '2026-05-30 09:12', rowsCount: 8 }
    ]),

    // Alerts
    alerts: getLocalItem<OperationalAlert[]>('logistics_alerts', [
      { id: 'a1', type: 'high_priority', title: 'Paket Expedite Mendesak', message: 'ColdChain Medis (EXP-88910) tersisa waktu kirim 3 jam.', time: '11:00 AM', severity: 'high' },
      { id: 'a2', type: 'backlog', title: 'Lonjakan Masa Backlog', message: 'Terdapat paket backlog menumpuk 5 hari di kurir Citra.', time: '10:15 AM', severity: 'medium' },
      { id: 'a3', type: 'delay', title: 'Kendala Lokasi Pengiriman', message: 'PT Angin Ribut (RESI773612) terhambat banjir rob Jakarta Utara.', time: '09:45 AM', severity: 'low' }
    ]),
  }),

  getters: {
    // Dynamic KPI summary statistics
    totalInboundCount(state): number {
      return state.inbound.length;
    },
    totalInboundWeight(state): number {
      return parseFloat(state.inbound.reduce((acc, curr) => acc + curr.weight, 0).toFixed(1));
    },
    totalProjectionVolume(state): number {
      return state.projection.reduce((acc, curr) => acc + curr.volume, 0);
    },
    expeditePriorityPending(state): number {
      return state.expedite.filter(p => p.status === 'pending' || p.urgency === 'Sangat Penting').length;
    },
    totalBacklogDays(state): number {
      return state.backlog.reduce((acc, curr) => acc + curr.days, 0);
    },
    overallCourierSla(state): number {
      if (state.performance.length === 0) return 100;
      const total = state.performance.reduce((acc, curr) => acc + curr.deliveries, 0);
      const success = state.performance.reduce((acc, curr) => acc + curr.success, 0);
      return total > 0 ? Math.round((success / total) * 100) : 100;
    },
    activeCouriersCount(state): number {
      return state.performance.length;
    },
    attendanceRate(state): number {
      const active = state.attendance.filter(a => a.status === 'Hadir').length;
      const total = state.attendance.length;
      return total > 0 ? Math.round((active / total) * 100) : 0;
    },
    courierAverageRating(state): number {
      if (state.performance.length === 0) return 5.0;
      const totalRating = state.performance.reduce((acc, curr) => acc + curr.rating, 0);
      return parseFloat((totalRating / state.performance.length).toFixed(2));
    },

    // Special logic for STD incomplete delivery courier mapping
    stdIncompleteCouriers(state): { courier: string; target: number; completed: number; pending: number }[] {
      // Group by courier from standard STD deliveries
      const courierMap: Record<string, { target: number; completed: number; pending: number }> = {};

      state.std.forEach((s) => {
        const name = s.courier;
        if (!courierMap[name]) {
          courierMap[name] = { target: 0, completed: 0, pending: 0 };
        }
        courierMap[name].target += s.target;
        courierMap[name].completed += s.completed;
        courierMap[name].pending += s.pending;
      });

      // Filter to only those with incomplete delivery (completed < target OR pending > 0)
      return Object.entries(courierMap)
        .map(([name, data]) => ({
          courier: name,
          ...data
        }))
        .filter(c => c.pending > 0 || c.completed < c.target);
    }
  },

  actions: {
    importData(menu: MenuKey, rawItems: any[]) {
      // Map based on the menu and replace/append
      // Note: As specified, we replace/refresh table or append. Standard monitoring updates replacement
      // Let's replace state to let manual user upload the current daily dataset.
      switch (menu) {
        case 'inbound':
          this.inbound = rawItems as InboundData[];
          setLocalItem('logistics_inbound', this.inbound);
          break;
        case 'projection':
          this.projection = rawItems as ProjectionData[];
          setLocalItem('logistics_projection', this.projection);
          break;
        case 'expedite':
          this.expedite = rawItems as ExpediteData[];
          setLocalItem('logistics_expedite', this.expedite);
          break;
        case 'backlog':
          this.backlog = rawItems as BacklogData[];
          setLocalItem('logistics_backlog', this.backlog);
          break;
        case 'std':
          this.std = rawItems as StdData[];
          setLocalItem('logistics_std', this.std);
          break;
        case 'performance':
          this.performance = rawItems as PerformanceData[];
          setLocalItem('logistics_performance', this.performance);
          break;
        case 'attendance':
          this.attendance = rawItems as AttendanceData[];
          setLocalItem('logistics_attendance', this.attendance);
          break;
      }

      // Add to activity log history
      const newLog: ActivityLog = {
        id: 'log_' + Date.now(),
        action: `Upload Data ${menu.toUpperCase()}`,
        menu: menu.charAt(0).toUpperCase() + menu.slice(1),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        rowsCount: rawItems.length
      };

      this.logs.unshift(newLog);
      setLocalItem('logistics_logs', this.logs);

      // Add a dynamic alert reflecting the new data import
      const newAlert: OperationalAlert = {
        id: 'alert_' + Date.now(),
        type: 'high_priority',
        title: `Data Baru Terimport: ${menu.toUpperCase()}`,
        message: `Sebanyak ${rawItems.length} baris data berhasil divalidasi dan diperbarui.`,
        time: 'Baru Saja',
        severity: 'low'
      };
      this.alerts.unshift(newAlert);
      setLocalItem('logistics_alerts', this.alerts);
    },

    clearData(menu: MenuKey) {
      switch (menu) {
        case 'inbound':
          this.inbound = [];
          setLocalItem('logistics_inbound', []);
          break;
        case 'projection':
          this.projection = [];
          setLocalItem('logistics_projection', []);
          break;
        case 'expedite':
          this.expedite = [];
          setLocalItem('logistics_expedite', []);
          break;
        case 'backlog':
          this.backlog = [];
          setLocalItem('logistics_backlog', []);
          break;
        case 'std':
          this.std = [];
          setLocalItem('logistics_std', []);
          break;
        case 'performance':
          this.performance = [];
          setLocalItem('logistics_performance', []);
          break;
        case 'attendance':
          this.attendance = [];
          setLocalItem('logistics_attendance', []);
          break;
      }

      const newLog: ActivityLog = {
        id: 'log_' + Date.now(),
        action: `Clear Data ${menu.toUpperCase()}`,
        menu: menu.charAt(0).toUpperCase() + menu.slice(1),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        rowsCount: 0
      };
      this.logs.unshift(newLog);
      setLocalItem('logistics_logs', this.logs);
    },

    clearAlert(id: string) {
      this.alerts = this.alerts.filter(x => x.id !== id);
      setLocalItem('logistics_alerts', this.alerts);
    },

    resetAllToDefault() {
      // Revert completely to sample data
      this.inbound = INITIAL_INBOUND;
      this.projection = INITIAL_PROJECTION;
      this.expedite = INITIAL_EXPEDITE;
      this.backlog = INITIAL_BACKLOG;
      this.std = INITIAL_STD;
      this.performance = INITIAL_PERFORMANCE;
      this.attendance = INITIAL_ATTENDANCE;

      setLocalItem('logistics_inbound', INITIAL_INBOUND);
      setLocalItem('logistics_projection', INITIAL_PROJECTION);
      setLocalItem('logistics_expedite', INITIAL_EXPEDITE);
      setLocalItem('logistics_backlog', INITIAL_BACKLOG);
      setLocalItem('logistics_std', INITIAL_STD);
      setLocalItem('logistics_performance', INITIAL_PERFORMANCE);
      setLocalItem('logistics_attendance', INITIAL_ATTENDANCE);

      this.logs = [
        { id: 'log_' + Date.now(), action: 'Reset ke Data Bawaan', menu: 'Sistem', timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16), rowsCount: 0 }
      ];
      setLocalItem('logistics_logs', this.logs);

      this.alerts = [
        { id: 'a1', type: 'high_priority', title: 'Paket Expedite Mendesak', message: 'ColdChain Medis (EXP-88910) tersisa waktu kirim 3 jam.', time: '11:00 AM', severity: 'high' },
        { id: 'a2', type: 'backlog', title: 'Lonjakan Masa Backlog', message: 'Terdapat paket backlog menumpuk 5 hari di kurir Citra.', time: '10:15 AM', severity: 'medium' }
      ];
      setLocalItem('logistics_alerts', this.alerts);
    }
  }
});
