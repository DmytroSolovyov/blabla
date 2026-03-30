export type Role = 'boss' | 'manager' | 'employee';

export interface User {
  uid: string;
  email: string;
  role: Role;
  name?: string;
}

export interface Location {
  id: string;
  name: string;
  createdBy: string;
}

export interface Worker {
  id: string;
  name: string;
  defaultColor?: string;
  createdBy: string;
  userId?: string;
}

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  employeeName: string;
  workerId?: string;
  locationId: string;
  color: string;
  period: 'AM' | 'PM';
  createdBy: string;
}
