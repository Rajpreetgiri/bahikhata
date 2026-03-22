import { useEffect, useState } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useScheduledReminderStore } from '../store/scheduledReminderStore';
import { ScheduledReminder } from '../types';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';

const OFFSET_OPTIONS = [
  { value: -7,  label: '7 days before due' },
  { value: -3,  label: '3 days before due' },
  { value: -1,  label: '1 day before due' },
  { value:  0,  label: 'On due date' },
  { value:  1,  label: '1 day after due' },
  { value:  3,  label: '3 days after due' },
  { value:  7,  label: '7 days after due' },
  { value: 14,  label: '14 days after due' },
];

const CHANNEL_OPTIONS = [
  { value: 'email',    label: 'Email' },
  { value: 'sms',      label: 'SMS' },
];

function offsetLabel(offsetDays: number): string {
  const opt = OFFSET_OPTIONS.find((o) => o.value === offsetDays);
  if (opt) return opt.label;
  if (offsetDays < 0) return `${Math.abs(offsetDays)} days before due`;
  if (offsetDays > 0) return `${offsetDays} days after due`;
  return 'On due date';
}

export default function ScheduledRemindersPage() {
  const { rules, isLoading, loadRules, addRule, toggleRule, deleteRule } = useScheduledReminderStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ offsetDays: -3, channels: ['email'] as string[] });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ScheduledReminder | null>(null);

  useEffect(() => { loadRules(); }, []);

  const handleChannelToggle = (ch: string) => {
    setAddForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));
  };

  const handleAdd = async () => {
    if (addForm.channels.length === 0) { toast.error('Select at least one channel'); return; }
    setSaving(true);
    try {
      await addRule(addForm);
      toast.success('Reminder rule added');
      setShowAddModal(false);
      setAddForm({ offsetDays: -3, channels: ['email'] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add rule'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: ScheduledReminder) => {
    try {
      await toggleRule(rule._id, !rule.isEnabled);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update rule'));
    }
  };

  const handleDelete = async (rule: ScheduledReminder) => {
    try {
      await deleteRule(rule._id);
      toast.success('Rule deleted');
      setToDelete(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete rule'));
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Auto Reminders" />

      <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-4">
        {/* Explainer */}
        <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Bell size={18} className="text-brand-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-brand-700">How it works</p>
              <p className="text-xs text-brand-600 mt-1 leading-relaxed">
                Set up rules to automatically remind customers based on their transaction due dates.
                The system runs every day at 9 AM and sends reminders for matching due dates.
                Due dates are set when recording a transaction.
              </p>
            </div>
          </div>
        </div>

        {/* Rules list */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : rules.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Bell size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No auto-reminder rules yet</p>
            <p className="text-xs mt-1">Add a rule to start sending reminders automatically</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule._id} className="card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{offsetLabel(rule.offsetDays)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      via {rule.channels.join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => handleToggle(rule)} className={rule.isEnabled ? 'text-brand-500' : 'text-gray-300'}>
                      {rule.isEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                    <button onClick={() => setToDelete(rule)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {!rule.isEnabled && (
                  <p className="text-[10px] text-gray-400 mt-2">Disabled — rule won't trigger</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-brand-200 text-brand-500 font-semibold py-3 rounded-2xl text-sm hover:bg-brand-50 transition-colors"
        >
          <Plus size={16} />
          Add Reminder Rule
        </button>
      </div>

      {/* Add Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="New Reminder Rule">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">When to send</label>
            <select
              value={addForm.offsetDays}
              onChange={(e) => setAddForm((f) => ({ ...f, offsetDays: parseInt(e.target.value, 10) }))}
              className="input-field"
            >
              {OFFSET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Channels</label>
            <div className="flex gap-2 flex-wrap">
              {CHANNEL_OPTIONS.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => handleChannelToggle(ch.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    addForm.channels.includes(ch.value)
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">WhatsApp reminders are sent manually via the customer page</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Add Rule'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete Rule?">
        <p className="text-gray-500 text-sm mb-5">
          Delete the "{toDelete && offsetLabel(toDelete.offsetDays)}" rule? Auto-reminders for this timing will stop.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setToDelete(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => toDelete && handleDelete(toDelete)} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
