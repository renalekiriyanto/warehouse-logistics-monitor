export type MenuKey =
  | 'inbound'
  | 'projection'
  | 'expedite'
  | 'backlog'
  | 'std'
  | 'performance'
  | 'attendance';

export type StatusType = 'pending' | 'completed' | 'delayed' | 'priority' | 'failed' | 'present' | 'absent' | 'leave';

export interface ColumnSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'time' | 'status';
  required?: boolean;
  unique?: boolean;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value: any;
}

export interface InboundData {
  resi: string;
  sender: string;
  receiver: string;
  destination: string;
  weight: number;
  courier: string;
  status: 'pending' | 'completed' | 'delayed';
}

export interface ProjectionData {
  date: string;
  volume: number;
  category: string;
  origin: string;
  pic: string;
  status: 'priority' | 'pending';
}

export interface ExpediteData {
  resi: string;
  itemName: string;
  deadline: string;
  courier: string;
  urgency: 'Sangat Penting' | 'Penting';
  status: 'pending' | 'completed' | 'delayed';
}

export interface BacklogData {
  resi: string;
  days: number;
  reason: string;
  courier: string;
  status: 'delayed';
}

export interface StdData {
  resi: string;
  courier: string;
  target: number;
  completed: number;
  pending: number;
  status: 'completed' | 'pending' | 'delayed';
}

export interface PerformanceData {
  courier: string;
  deliveries: number;
  success: number;
  failed: number;
  rating: number; // 1-5
  status: 'completed' | 'delayed';
}

export interface AttendanceData {
  courier: string;
  date: string;
  shift: 'Pagi' | 'Siang' | 'Malam';
  checkIn: string; // HH:MM
  status: 'Hadir' | 'Izin' | 'Alpa';
}

export interface OperationalAlert {
  id: string;
  type: 'delay' | 'backlog' | 'failed_delivery' | 'high_priority';
  title: string;
  message: string;
  time: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ActivityLog {
  id: string;
  action: string;
  menu: string;
  timestamp: string;
  rowsCount: number;
}
