import { ColumnSchema, ValidationError, MenuKey } from '../types';

export const MENU_SCHEMAS: Record<MenuKey, ColumnSchema[]> = {
  inbound: [
    { key: 'date_inbound', label: 'Tanggal Inbound', type: 'date', required: true },
    { key: 'type_slot', label: 'Tipe Slot', type: 'string', required: true },
    { key: 'actual_arrival', label: 'Kedatangan Aktual', type: 'time', required: true },
    { key: 'total_order', label: 'Total Order', type: 'number', required: true },
  ],
  projection: [
    { key: 'date', label: 'Tanggal Proyeksi', type: 'date', required: true },
    { key: 'volume', label: 'Ekspektasi Volum', type: 'number', required: true },
    { key: 'category', label: 'Kategori Cargo', type: 'string', required: true },
    { key: 'origin', label: 'Asal Shipment', type: 'string', required: true },
    { key: 'pic', label: 'PIC Logistik', type: 'string', required: true },
    { key: 'status', label: 'Status', type: 'status', required: true },
  ],
  expedite: [
    { key: 'resi', label: 'No Resi', type: 'string', required: true, unique: true },
    { key: 'itemName', label: 'Nama Paket', type: 'string', required: true },
    { key: 'deadline', label: 'Waktu Batas', type: 'date', required: true },
    { key: 'courier', label: 'Kurir', type: 'string', required: true },
    { key: 'urgency', label: 'Tingkat Urgensi', type: 'string', required: true },
    { key: 'status', label: 'Status', type: 'status', required: true },
  ],
  backlog: [
    { key: 'resi', label: 'No Resi', type: 'string', required: true },
    { key: 'days', label: 'Hari Habis Batas', type: 'number', required: true },
    { key: 'reason', label: 'Alasan Backlog', type: 'string', required: true },
    { key: 'courier', label: 'Kurir', type: 'string', required: true },
    { key: 'status', label: 'Status', type: 'status', required: true },
  ],
  std: [
    { key: 'resi', label: 'No Resi', type: 'string', required: true, unique: true },
    { key: 'courier', label: 'Nama Kurir', type: 'string', required: true },
    { key: 'target', label: 'Target Pengiriman', type: 'number', required: true },
    { key: 'completed', label: 'Diselesaikan', type: 'number', required: true },
    { key: 'pending', label: 'Pending', type: 'number', required: true },
    { key: 'status', label: 'Status', type: 'status', required: true },
  ],
  performance: [
    { key: 'courier', label: 'Nama Kurir', type: 'string', required: true, unique: true },
    { key: 'deliveries', label: 'Total Pengiriman', type: 'number', required: true },
    { key: 'success', label: 'Berhasil', type: 'number', required: true },
    { key: 'failed', label: 'Gagal', type: 'number', required: true },
    { key: 'rating', label: 'Rating', type: 'number', required: true },
    { key: 'status', label: 'Status', type: 'status', required: true },
  ],
  attendance: [
    { key: 'courier', label: 'Nama Kurir', type: 'string', required: true },
    { key: 'date', label: 'Tanggal', type: 'date', required: true },
    { key: 'shift', label: 'Shift', type: 'string', required: true },
    { key: 'checkIn', label: 'Jam Masuk', type: 'time', required: true },
    { key: 'status', label: 'Status Kehadiran', type: 'string', required: true },
  ],
};

// Generates comma-separated header & dummy rows for sample download
export function generateCSVSample(menu: MenuKey): string {
  const schemas = MENU_SCHEMAS[menu];
  const headers = schemas.map((s) => `"${s.label}"`).join(',');

  let sampleRow1 = '';
  let sampleRow2 = '';

  switch (menu) {
    case 'inbound':
      sampleRow1 = '"2026-05-31","1","08:30",12';
      sampleRow2 = '"2026-05-31","2","13:15",25';
      break;
    case 'projection':
      sampleRow1 = '"2026-05-30",1500,"Alat Rumah Tangga","Bandung Warehouse","Heri Kurniawan","pending"';
      sampleRow2 = '"2026-05-31",3200,"Elektronik","Cikarang Plant","Rian Wijaya","priority"';
      break;
    case 'expedite':
      sampleRow1 = '"RESI992110","Obat-obatan Urgent","2026-05-30 18:00","Citra","Sangat Penting","pending"';
      sampleRow2 = '"RESI992111","Suku Cadang Mesin","2026-05-31 12:00","Andi","Penting","completed"';
      break;
    case 'backlog':
      sampleRow1 = '"RESI102923",5,"Alamat rumah kosong","Andi","delayed"';
      sampleRow2 = '"RESI108212",3,"Nomor telepon tidak aktif","Budi","delayed"';
      break;
    case 'std':
      sampleRow1 = '"RESI501921","Andi",12,8,4,"pending"';
      sampleRow2 = '"RESI501922","Budi",5,3,2,"pending"';
      break;
    case 'performance':
      sampleRow1 = '"Andi",120,110,10,4.6,"completed"';
      sampleRow2 = '"Budi",98,90,8,4.2,"completed"';
      break;
    case 'attendance':
      sampleRow1 = '"Andi","2026-05-30","Pagi","07:15","Hadir"';
      sampleRow2 = '"Budi","2026-05-30","Pagi","07:30","Hadir"';
      break;
  }

  return `${headers}\n${sampleRow1}\n${sampleRow2}`;
}

export function parseCSV(text: string, menu: MenuKey): { items: any[]; errors: ValidationError[] } {
  const schemas = MENU_SCHEMAS[menu];
  const errors: ValidationError[] = [];
  const items: any[] = [];

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2) {
    errors.push({
      row: 0,
      column: 'File',
      message: 'Format file CSV tidak valid atau baris data kosong.',
      value: '',
    });
    return { items, errors };
  }

  const parsedRows: string[][] = [];
  
  // Custom CSV parser handling quotes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const row: string[] = [];
    let inQuotes = false;
    let currentCell = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === ';') && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    parsedRows.push(row);
  }

  const fileHeaders = parsedRows[0].map(h => h.replace(/^"|"$/g, '').toLowerCase());
  const dataRows = parsedRows.slice(1);

  // Set of values to track column uniqueness (e.g. unique resi codes)
  const uniqueKeysTracking: Record<string, Set<any>> = {};
  schemas.forEach((s) => {
    if (s.unique) {
      uniqueKeysTracking[s.key] = new Set();
    }
  });

  dataRows.forEach((row, rowIndex) => {
    const docRowNumber = rowIndex + 2; // 1-based index including header
    const item: Record<string, any> = {};
    let hasRowError = false;

    schemas.forEach((schema, colIndex) => {
      // Direct lookup by header mapping or by index fallback
      let rawVal: any = undefined;
      const mappedHeaderIdx = fileHeaders.findIndex((fh) => fh === schema.label.toLowerCase() || fh === schema.key.toLowerCase());
      
      if (mappedHeaderIdx !== -1 && row[mappedHeaderIdx] !== undefined) {
        rawVal = row[mappedHeaderIdx].replace(/^"|"$/g, '');
      } else if (row[colIndex] !== undefined) {
        rawVal = row[colIndex].replace(/^"|"$/g, '');
      }

      if (rawVal === undefined || rawVal === '') {
        if (schema.required) {
          errors.push({
            row: docRowNumber,
            column: schema.label,
            message: `Kolom '${schema.label}' wajib diisi.`,
            value: '',
          });
          hasRowError = true;
        }
        item[schema.key] = schema.type === 'number' ? 0 : '';
        return;
      }

      let parsedVal: any = rawVal;

      if (schema.type === 'number') {
        const num = parseFloat(rawVal);
        if (isNaN(num)) {
          errors.push({
            row: docRowNumber,
            column: schema.label,
            message: `Nilai '${rawVal}' bukan angka valid.`,
            value: rawVal,
          });
          hasRowError = true;
          parsedVal = 0;
        } else {
          parsedVal = num;
          // Sub-validation
          if (schema.key === 'weight' && num <= 0) {
            errors.push({
              row: docRowNumber,
              column: schema.label,
              message: 'Berat paket harus lebih besar dari 0.',
              value: num,
            });
            hasRowError = true;
          }
          if (schema.key === 'rating' && (num < 1 || num > 5)) {
            errors.push({
              row: docRowNumber,
              column: schema.label,
              message: 'Rating kurir harus berada dalam rentang 1 s.d 5.',
              value: num,
            });
            hasRowError = true;
          }
          if ((schema.key === 'volume' || schema.key === 'days' || schema.key === 'target' || schema.key === 'completed' || schema.key === 'pending') && num < 0) {
            errors.push({
              row: docRowNumber,
              column: schema.label,
              message: 'Nilai angka tidak boleh negatif.',
              value: num,
            });
            hasRowError = true;
          }
        }
      } else if (schema.type === 'date') {
        const timeVal = Date.parse(rawVal);
        if (isNaN(timeVal) && !/^\d{4}-\d{2}-\d{2}/.test(rawVal)) {
          errors.push({
            row: docRowNumber,
            column: schema.label,
            message: `Format tanggal '${rawVal}' salah (gunakan YYYY-MM-DD).`,
            value: rawVal,
          });
          hasRowError = true;
        }
      } else if (schema.type === 'time') {
        const trimmedVal = rawVal.trim();
        if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmedVal)) {
          errors.push({
            row: docRowNumber,
            column: schema.label,
            message: `Format waktu '${rawVal}' salah (gunakan HH:MM atau HH:MM:SS dalam format 24 jam).`,
            value: rawVal,
          });
          hasRowError = true;
        } else {
          // Pad hours if single digit, e.g. 8:30 -> 08:30
          let [h, m, s] = trimmedVal.split(':');
          const hh = h.padStart(2, '0');
          const mm = m.padStart(2, '0');
          const ss = s ? s.padStart(2, '0') : '00';
          parsedVal = `${hh}:${mm}:${ss}`;
        }
      } else if (schema.type === 'status') {
        parsedVal = rawVal.toLowerCase().trim();
        const validStatuses = ['pending', 'completed', 'delayed', 'priority', 'hadir', 'izin', 'alpa'];
        if (!validStatuses.includes(parsedVal)) {
          errors.push({
            row: docRowNumber,
            column: schema.label,
            message: `Status '${rawVal}' tidak dikenal. Pilih dari: pending, completed, delayed, atau priority.`,
            value: rawVal,
          });
          // Do not fail completely, just use it
        }
      }

      // Check for duplicates
      if (schema.unique && uniqueKeysTracking[schema.key]) {
        if (uniqueKeysTracking[schema.key].has(parsedVal)) {
          errors.push({
            row: docRowNumber,
            column: schema.label,
            message: `Nilai duplikat ditemukan: '${parsedVal}' pada kolom unique '${schema.label}'.`,
            value: parsedVal,
          });
          hasRowError = true;
        } else {
          uniqueKeysTracking[schema.key].add(parsedVal);
        }
      }

      item[schema.key] = parsedVal;
    });

    // Save index reference for row highlight in preview table
    item._row_index = docRowNumber;
    item._invalid = hasRowError;
    items.push(item);
  });

  return { items, errors };
}
