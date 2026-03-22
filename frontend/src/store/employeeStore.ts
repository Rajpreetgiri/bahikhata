import { create } from 'zustand';
import { Employee, AttendanceRecord, AttendanceSummary } from '../types';
import api from '../lib/api';

interface EmployeeState {
  employees: Employee[];
  isLoading: boolean;
  loadEmployees: () => Promise<void>;
  addEmployee: (data: {
    name: string; phone?: string; role?: string;
    salaryType: 'monthly' | 'daily'; salaryAmount: number; joinDate?: string;
  }) => Promise<Employee>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  giveAdvance: (id: string, amount: number) => Promise<void>;
  loadAttendance: (employeeId: string, month: string) => Promise<{
    records: AttendanceRecord[];
    summary: AttendanceSummary;
    employee: { name: string; salaryType: string; salaryAmount: number; advanceBalance: number };
  }>;
  markAttendance: (employeeId: string, date: string, status: string, note?: string) => Promise<void>;
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  isLoading: false,

  loadEmployees: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<Employee[]>('/api/employees');
      set({ employees: Array.isArray(res.data) ? res.data : [] });
    } finally {
      set({ isLoading: false });
    }
  },

  addEmployee: async (data) => {
    const res = await api.post<Employee>('/api/employees', data);
    set((s) => ({ employees: [...s.employees, res.data] }));
    return res.data;
  },

  updateEmployee: async (id, data) => {
    const res = await api.put<Employee>(`/api/employees/${id}`, data);
    set((s) => ({ employees: s.employees.map((e) => (e._id === id ? res.data : e)) }));
  },

  deleteEmployee: async (id) => {
    await api.delete(`/api/employees/${id}`);
    set((s) => ({ employees: s.employees.filter((e) => e._id !== id) }));
  },

  giveAdvance: async (id, amount) => {
    const res = await api.post<{ advanceBalance: number }>(`/api/employees/${id}/advance`, { amount });
    set((s) => ({
      employees: s.employees.map((e) => (e._id === id ? { ...e, advanceBalance: res.data.advanceBalance } : e)),
    }));
  },

  loadAttendance: async (employeeId, month) => {
    const res = await api.get(`/api/employees/${employeeId}/attendance`, { params: { month } });
    return res.data as {
      records: AttendanceRecord[];
      summary: AttendanceSummary;
      employee: { name: string; salaryType: string; salaryAmount: number; advanceBalance: number };
    };
  },

  markAttendance: async (employeeId, date, status, note) => {
    await api.post(`/api/employees/${employeeId}/attendance`, { date, status, note });
  },
}));
