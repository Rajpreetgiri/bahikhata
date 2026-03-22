import { useState, useEffect } from 'react';
import { FileText, Download, FileSpreadsheet, Building2, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '../lib/api';
import { useCustomerStore } from '../store/customerStore';
import Spinner from '../components/ui/Spinner';
import PageHeader from '../components/layout/PageHeader';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface GstRow {
  month: number;
  totalSales: number;
  totalGst: number;
  invoiceCount: number;
}

export default function ReportsPage() {
  const { customers, loadCustomers, isLoading } = useCustomerStore();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // GST summary state
  const [gstYear, setGstYear] = useState(new Date().getFullYear());
  const [gstRows, setGstRows] = useState<GstRow[]>([]);
  const [gstLoading, setGstLoading] = useState(false);
  const [showGst, setShowGst] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  const buildQuery = (extraParams?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (extraParams) Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const downloadFile = async (baseUrl: string, filename: string, key: string) => {
    setDownloading(key);
    try {
      const res = await api.get(`${baseUrl}${buildQuery()}`, { responseType: 'blob' });
      const href = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
      toast.success('Downloaded!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  const loadGstSummary = async () => {
    setGstLoading(true);
    try {
      const res = await api.get<{ year: number; months: GstRow[] }>(`/api/reports/gst-summary?year=${gstYear}`);
      setGstRows(res.data.months);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load GST summary'));
    } finally {
      setGstLoading(false);
    }
  };

  useEffect(() => {
    if (showGst) loadGstSummary();
  }, [showGst, gstYear]);

  const hasDateFilter = !!(dateFrom || dateTo);
  const periodLabel = dateFrom && dateTo
    ? `${new Date(dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(dateTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : dateFrom ? `From ${new Date(dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : dateTo ? `Until ${new Date(dateTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : 'All time';

  const gstTotal = gstRows.reduce((s, r) => ({ sales: s.sales + r.totalSales, gst: s.gst + r.totalGst, count: s.count + r.invoiceCount }), { sales: 0, gst: 0, count: 0 });

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Reports">
        <p className="text-sm text-gray-400 mt-0.5">Download PDF or Excel statements</p>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Date range filter */}
        <div className="card">
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="flex items-center justify-between w-full"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">Date Range Filter</p>
              <p className={`text-xs mt-0.5 ${hasDateFilter ? 'text-brand-500 font-medium' : 'text-gray-400'}`}>{periodLabel}</p>
            </div>
            {showDateFilter ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {showDateFilter && (
            <div className="mt-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field text-sm" />
                </div>
              </div>
              {hasDateFilter && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-red-500 font-medium">
                  Clear dates
                </button>
              )}
            </div>
          )}
        </div>

        {/* Business summary */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Business Summary</p>
              <p className="text-xs text-gray-400">All customers overview</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadFile('/api/reports/business/pdf', 'business_summary.pdf', 'biz-pdf')}
              disabled={downloading === 'biz-pdf'}
              className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {downloading === 'biz-pdf' ? <Spinner size={16} /> : <FileText size={16} />}
              PDF
            </button>
            <button
              onClick={() => downloadFile('/api/reports/business/excel', 'business_summary.xlsx', 'biz-xl')}
              disabled={downloading === 'biz-xl'}
              className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              {downloading === 'biz-xl' ? <Spinner size={16} /> : <FileSpreadsheet size={16} />}
              Excel
            </button>
          </div>
        </div>

        {/* GST Summary */}
        <div className="card">
          <button
            onClick={() => setShowGst(!showGst)}
            className="flex items-center justify-between w-full mb-1"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                <BarChart2 size={18} className="text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800 text-sm">GST Summary</p>
                <p className="text-xs text-gray-400">Monthly tax breakdown</p>
              </div>
            </div>
            {showGst ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {showGst && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-3">
                <label className="text-xs font-medium text-gray-500">Year:</label>
                <select
                  value={gstYear}
                  onChange={(e) => setGstYear(parseInt(e.target.value))}
                  className="input-field text-sm py-1.5 w-28"
                >
                  {[0, 1, 2].map((offset) => {
                    const y = new Date().getFullYear() - offset;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>

              {gstLoading ? (
                <div className="flex justify-center py-6"><Spinner size={24} /></div>
              ) : gstRows.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">No invoices found for {gstYear}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-2 py-2 text-gray-500 font-semibold">Month</th>
                        <th className="text-right px-2 py-2 text-gray-500 font-semibold">Sales</th>
                        <th className="text-right px-2 py-2 text-gray-500 font-semibold">GST</th>
                        <th className="text-right px-2 py-2 text-gray-500 font-semibold">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstRows.map((row) => (
                        <tr key={row.month} className="border-b border-gray-50">
                          <td className="px-2 py-2 font-medium text-gray-700">{MONTH_NAMES[row.month - 1]}</td>
                          <td className="px-2 py-2 text-right text-gray-700">₹{row.totalSales.toLocaleString('en-IN')}</td>
                          <td className="px-2 py-2 text-right text-purple-600 font-semibold">₹{row.totalGst.toLocaleString('en-IN')}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{row.invoiceCount}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-2 py-2 text-gray-700">Total</td>
                        <td className="px-2 py-2 text-right text-gray-700">₹{gstTotal.sales.toLocaleString('en-IN')}</td>
                        <td className="px-2 py-2 text-right text-purple-600">₹{gstTotal.gst.toLocaleString('en-IN')}</td>
                        <td className="px-2 py-2 text-right text-gray-500">{gstTotal.count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Per-customer reports */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pt-2">
          Customer Statements
        </p>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner size={32} /></div>
        ) : (
          customers.map((c) => (
            <div key={c._id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${c.totalOutstanding > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{c.name}</p>
                  <p className={`text-xs font-medium ${c.totalOutstanding > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    ₹{Math.abs(c.totalOutstanding).toLocaleString('en-IN')}
                    {c.totalOutstanding > 0 ? ' outstanding' : c.totalOutstanding < 0 ? ' advance' : ' settled'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadFile(`/api/reports/customer/${c._id}/pdf`, `${c.name}_statement.pdf`, `pdf-${c._id}`)}
                  disabled={downloading === `pdf-${c._id}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {downloading === `pdf-${c._id}` ? <Spinner size={14} /> : <Download size={14} />}
                  PDF
                </button>
                <button
                  onClick={() => downloadFile(`/api/reports/customer/${c._id}/excel`, `${c.name}_statement.xlsx`, `xl-${c._id}`)}
                  disabled={downloading === `xl-${c._id}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-600 py-2 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  {downloading === `xl-${c._id}` ? <Spinner size={14} /> : <Download size={14} />}
                  Excel
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
