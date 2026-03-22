import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserPlus, Users, Calendar, ChevronRight,
  IndianRupee, AlertCircle, Check, X, Minus, Clock,
} from 'lucide-react';
import { useEmployeeStore } from '../store/employeeStore';
import { Employee, AttendanceRecord, AttendanceSummary } from '../types';
import toast from 'react-hot-toast';

type View = 'list' | 'attendance' | 'add';

const ATTENDANCE_STATUSES = [
  { value: 'present', label: 'P', icon: Check, color: 'bg-green-500 text-white', title: 'Present' },
  { value: 'half_day', label: 'H', icon: Minus, color: 'bg-yellow-400 text-white', title: 'Half Day' },
  { value: 'absent', label: 'A', icon: X, color: 'bg-red-500 text-white', title: 'Absent' },
  { value: 'holiday', label: '🎉', icon: Clock, color: 'bg-gray-200 text-gray-600', title: 'Holiday' },
];

function statusStyle(status?: string) {
  return ATTENDANCE_STATUSES.find((s) => s.value === status)?.color ?? 'bg-gray-100 text-gray-500';
}
function statusLabel(status?: string) {
  return ATTENDANCE_STATUSES.find((s) => s.value === status)?.label ?? '—';
}

export default function PagarKhataPage() {
  const navigate = useNavigate();
  const { employees, isLoading, loadEmployees, addEmployee, deleteEmployee, giveAdvance, loadAttendance, markAttendance } = useEmployeeStore();

  const [view, setView] = useState<View>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [attendanceData, setAttendanceData] = useState<{
    records: AttendanceRecord[];
    summary: AttendanceSummary;
    employee: { name: string; salaryType: string; salaryAmount: number; advanceBalance: number };
  } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Add employee form
  const [addForm, setAddForm] = useState({
    name: '', phone: '', role: '', salaryType: 'monthly' as 'monthly' | 'daily', salaryAmount: '', joinDate: '',
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const fetchAttendance = async (empId: string, month: string) => {
    setAttendanceLoading(true);
    try {
      const data = await loadAttendance(empId, month);
      setAttendanceData(data);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const openAttendance = (emp: Employee) => {
    setSelectedEmployee(emp);
    setView('attendance');
    fetchAttendance(emp._id, currentMonth);
  };

  const handleMonthChange = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonth);
    if (selectedEmployee) fetchAttendance(selectedEmployee._id, newMonth);
  };

  const getDaysInMonth = (month: string): Date[] => {
    const [y, m] = month.split('-').map(Number);
    const days: Date[] = [];
    const total = new Date(y, m, 0).getDate();
    for (let d = 1; d <= total; d++) days.push(new Date(y, m - 1, d));
    return days;
  };

  const getRecord = (date: Date): AttendanceRecord | undefined => {
    const iso = date.toISOString().split('T')[0];
    return attendanceData?.records.find((r) => r.date.startsWith(iso));
  };

  const toggleAttendance = async (date: Date, current?: AttendanceStatus) => {
    if (!selectedEmployee) return;
    const order: AttendanceStatus[] = ['present', 'half_day', 'absent', 'holiday'];
    const nextIdx = current ? (order.indexOf(current) + 1) % order.length : 0;
    const next = order[nextIdx];
    try {
      await markAttendance(selectedEmployee._id, date.toISOString().split('T')[0], next);
      fetchAttendance(selectedEmployee._id, currentMonth);
    } catch {
      toast.error('Failed to mark attendance');
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.salaryAmount) { toast.error('Name and salary required'); return; }
    setAdding(true);
    try {
      await addEmployee({
        name: addForm.name.trim(),
        phone: addForm.phone || undefined,
        role: addForm.role || undefined,
        salaryType: addForm.salaryType,
        salaryAmount: parseFloat(addForm.salaryAmount),
        joinDate: addForm.joinDate || undefined,
      });
      setAddForm({ name: '', phone: '', role: '', salaryType: 'monthly', salaryAmount: '', joinDate: '' });
      setView('list');
      toast.success('Employee added');
    } catch {
      toast.error('Failed to add employee');
    } finally {
      setAdding(false);
    }
  };

  type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'holiday';

  // ── Views ───────────────────────────────────────────────────────────────────

  if (view === 'add') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setView('list')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex-1">Add Employee</h1>
        </div>
        <div className="p-4 max-w-lg mx-auto space-y-4">
          {[
            { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Ramesh Kumar' },
            { label: 'Phone', key: 'phone', type: 'tel', placeholder: '+91 98765 43210' },
            { label: 'Role / Designation', key: 'role', type: 'text', placeholder: 'Cashier, Manager...' },
            { label: 'Join Date', key: 'joinDate', type: 'date', placeholder: '' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={(addForm as Record<string, string>)[key]}
                onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Salary Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['monthly', 'daily'] as const).map((t) => (
                <button key={t} onClick={() => setAddForm((f) => ({ ...f, salaryType: t }))}
                  className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${addForm.salaryType === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>
                  {t === 'monthly' ? 'Monthly Salary' : 'Daily Wage'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {addForm.salaryType === 'monthly' ? 'Monthly Salary (₹)' : 'Daily Rate (₹)'}
            </label>
            <input type="number" value={addForm.salaryAmount}
              onChange={(e) => setAddForm((f) => ({ ...f, salaryAmount: e.target.value }))}
              placeholder="0" min="0"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="flex gap-3 pb-6">
            <button onClick={() => setView('list')} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50">
              {adding ? 'Saving...' : 'Add Employee'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'attendance' && selectedEmployee) {
    const days = getDaysInMonth(currentMonth);
    const [y, m] = currentMonth.split('-').map(Number);
    const monthName = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setView('list')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">{selectedEmployee.name}</h1>
            <p className="text-xs text-gray-500">{selectedEmployee.role || 'Employee'}</p>
          </div>
        </div>

        <div className="p-4 max-w-lg mx-auto space-y-4">
          {/* Month navigator */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <button onClick={() => handleMonthChange(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">←</button>
            <span className="font-semibold text-gray-900">{monthName}</span>
            <button onClick={() => handleMonthChange(1)} className="p-1.5 rounded-lg hover:bg-gray-100">→</button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-xs">
            {ATTENDANCE_STATUSES.map((s) => (
              <span key={s.value} className={`px-2 py-1 rounded-lg font-medium ${s.color}`}>{s.label} = {s.title}</span>
            ))}
          </div>

          {/* Calendar grid */}
          {attendanceLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                  <div key={d} className="text-center text-xs text-gray-400 font-medium pb-1">{d}</div>
                ))}
                {/* Empty cells for alignment */}
                {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map((day) => {
                  const record = getRecord(day);
                  const isFuture = day > new Date();
                  return (
                    <button
                      key={day.getDate()}
                      disabled={isFuture}
                      onClick={() => !isFuture && toggleAttendance(day, record?.status as AttendanceStatus)}
                      className={`aspect-square rounded-xl text-xs font-semibold flex items-center justify-center transition-colors
                        ${isFuture ? 'opacity-30 cursor-not-allowed bg-gray-50' : record ? statusStyle(record.status) : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {record ? statusLabel(record.status) : day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          {attendanceData && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Month Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{attendanceData.summary.present}</p>
                  <p className="text-xs text-green-600">Present</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{attendanceData.summary.halfDay}</p>
                  <p className="text-xs text-yellow-600">Half Day</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{attendanceData.summary.absent}</p>
                  <p className="text-xs text-red-600">Absent</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-700">{attendanceData.summary.effectiveDays.toFixed(1)}</p>
                  <p className="text-xs text-indigo-600">Effective Days</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Net Salary</p>
                  <p className="text-2xl font-bold text-gray-900">₹{attendanceData.summary.netSalary.toLocaleString('en-IN')}</p>
                </div>
                {attendanceData.employee.advanceBalance > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Advance Given</p>
                    <p className="text-lg font-semibold text-red-600">-₹{attendanceData.employee.advanceBalance.toLocaleString('en-IN')}</p>
                    <p className="text-sm font-bold text-gray-900">
                      Payable: ₹{Math.max(0, attendanceData.summary.netSalary - attendanceData.employee.advanceBalance).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Employee list view
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold flex-1">PagarKhata</h1>
        <button onClick={() => setView('add')} className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <UserPlus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No employees yet</p>
            <button onClick={() => setView('add')} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">
              Add First Employee
            </button>
          </div>
        ) : (
          employees.map((emp) => (
            <div key={emp._id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold">{emp.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-500">
                    {emp.role ? `${emp.role} · ` : ''}
                    ₹{emp.salaryAmount.toLocaleString('en-IN')}/{emp.salaryType === 'monthly' ? 'mo' : 'day'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {emp.advanceBalance > 0 && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Adv ₹{emp.advanceBalance}
                    </span>
                  )}
                  <button onClick={() => openAttendance(emp)} className="p-2 rounded-xl hover:bg-gray-100">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
