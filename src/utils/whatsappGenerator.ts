import { useLogisticsStore } from '../store/logisticsStore';

export function getShiftForTime(hour: number): 'Pagi' | 'Siang' | 'Malam' {
  if (hour >= 6 && hour < 14) return 'Pagi';
  if (hour >= 14 && hour < 22) return 'Siang';
  return 'Malam';
}

export function generateWhatsAppReport(shiftOverride?: 'Pagi' | 'Siang' | 'Malam'): string {
  const store = useLogisticsStore();
  const currentDate = new Date();
  
  // Format local date
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  const dayName = dayNames[currentDate.getDay()];
  const dateStr = `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const timeStr = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')} WIB`;
  
  const shiftText = shiftOverride || getShiftForTime(currentDate.getHours());

  // STD Incomplete list stringifying
  const incompleteCouriers = store.stdIncompleteCouriers;
  let stdSection = '';
  if (incompleteCouriers.length === 0) {
    stdSection = '✅ Semua kurir telah menyelesaikan paket STD 100%.';
  } else {
    stdSection = 'Kurir dengan paket STD belum selesai 100%:\n' + 
      incompleteCouriers.map(c => 
        `- ${c.courier}: ${c.target} assigned, ${c.completed} delivered, ${c.pending} pending`
      ).join('\n');
  }

  // Backlog issues list
  const backlogIssues = store.backlog.slice(0, 3).map(b => 
    `- Resin ${b.resi} (${b.courier}): ${b.reason} (Sudah ${b.days} hari)`
  ).join('\n');

  // Courier performance top status
  const courierPerf = store.performance.slice(0, 3).map(p =>
    `- ${p.courier}: SLA ${Math.round((p.success/p.deliveries)*100)}% (${p.deliveries} kirim, ⭐ ${p.rating})`
  ).join('\n');

  // Attendance rate breakdown
  const totalInAttendance = store.attendance.length;
  const presentCount = store.attendance.filter(a => a.status === 'Hadir').length;
  const leavesCount = store.attendance.filter(a => a.status === 'Izin').length;

  return `📦 LAPORAN OPERASIONAL MONITORING WAREHOUSE
-------------------------------------------
Hari/Tanggal : ${dayName}, ${dateStr}
Waktu Cetak  : ${timeStr}
Shift Kerja  : ${shiftText}

🚀 KEY PERFORMANCE INDICATORS (KPI)
• Total Inbound      : ${store.totalInboundCount} paket (${store.totalInboundWeight} Kg)
• Proyeksi Esok      : ${store.totalProjectionVolume} paket volume
• Expedite Urgen     : ${store.expeditePriorityPending} paket prioritas pending
• Akumulasi Backlog  : ${store.backlog.length} paket
• Tingkat Kehadiran  : ${store.attendanceRate}% (${presentCount}/${totalInAttendance} kurir)
• SLA Rata-rata      : ${store.overallCourierSla}% (Rating ⭐ ${store.courierAverageRating})

📊 SUMMARY OPERASIONAL MENYELURUH

1. INBOUND & EXPEDITE PARCEL
• Pengiriman inbound yang termonitor didominasi oleh merchant e-commerce utama.
• Terdapat ${store.expedite.filter(p => p.status === 'pending').length} paket expedite pending yang butuh prioritas dispatch instan.

2. TRACKING DELIVERIES (STD)
${stdSection}

3. MASALAH & HAMBATAN UTAMA (BACKLOG)
${backlogIssues || '- Nihil backlog termonitor hari ini.'}

4. KINERJA UTAMA KURIR (TOP PERFORMANCE)
${courierPerf || '- Belum ada data pengumpulan kurir.'}

5. ABSENSI & PRESENSI STAFF KURIR
• Total Terdaftar    : ${totalInAttendance} Kurir
• Hadir Tepat Waktu  : ${presentCount} Kurir
• Izin/Sakit/Absen   : ${leavesCount} Orang

⚠️ RENCANA PRIORITAS DAN TINDAKAN SEGERA:
1. Hubungi kurir dengan paket STD pending untuk menyelesaikan sisa pengiriman sebelum cut-off shift.
2. Segera follow-up backlog yang menumpuk di atas 3 hari (terutama kurir Citra) untuk verifikasi alamat ulang.
3. Alokasikan kurir cadangan shift berikutnya untuk rute yang mengalami kendala cuaca/banjir.

Laporan ini dibuat secara otomatis melalui Warehouse Logistics Monitor PWA.
-------------------------------------------`;
}
