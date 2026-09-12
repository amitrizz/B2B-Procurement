'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Plus, Trash2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type ChatPurpose = 'ORDER_STATUS' | 'REPEAT_ORDER';

type AnswerRow = { id?: string; label: string; sortOrder: number; isActive: boolean };

type ChatQuestion = {
  id: string;
  purpose: ChatPurpose;
  questionText: string;
  sortOrder: number;
  isActive: boolean;
  answers: AnswerRow[];
};

const PURPOSE_LABELS: Record<ChatPurpose, string> = {
  ORDER_STATUS: 'Order Status',
  REPEAT_ORDER: 'Repeat Order',
};

const emptyForm = (): {
  purpose: ChatPurpose;
  questionText: string;
  sortOrder: number;
  answers: AnswerRow[];
} => ({
  purpose: 'ORDER_STATUS',
  questionText: '',
  sortOrder: 0,
  answers: [{ label: '', sortOrder: 1, isActive: true }],
});

export default function AdminChatQaSection() {
  const [questions, setQuestions] = useState<ChatQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | ChatPurpose>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/chat-qa', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data || []);
      } else {
        alert(data.message || 'Failed to load chat Q&A');
      }
    } catch {
      alert('Failed to load chat Q&A');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (q: ChatQuestion) => {
    setEditingId(q.id);
    setForm({
      purpose: q.purpose,
      questionText: q.questionText,
      sortOrder: q.sortOrder,
      answers:
        q.answers.length > 0
          ? q.answers.map((a) => ({ ...a }))
          : [{ label: '', sortOrder: 1, isActive: true }],
    });
    setShowForm(true);
  };

  const addAnswerRow = () => {
    setForm((prev) => ({
      ...prev,
      answers: [...prev.answers, { label: '', sortOrder: prev.answers.length + 1, isActive: true }],
    }));
  };

  const updateAnswer = (index: number, label: string) => {
    setForm((prev) => ({
      ...prev,
      answers: prev.answers.map((a, i) => (i === index ? { ...a, label } : a)),
    }));
  };

  const removeAnswer = (index: number) => {
    setForm((prev) => ({
      ...prev,
      answers: prev.answers.filter((_, i) => i !== index),
    }));
  };

  const saveQuestion = async () => {
    if (!form.questionText.trim()) {
      alert('Question text is required');
      return;
    }
    const answers = form.answers.map((a, i) => ({ ...a, label: a.label.trim(), sortOrder: i + 1 })).filter((a) => a.label);
    if (answers.length === 0) {
      alert('Add at least one seller answer');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        purpose: form.purpose,
        questionText: form.questionText.trim(),
        sortOrder: form.sortOrder,
        isActive: true,
        answers,
      };
      const url = editingId ? `/api/v1/admin/chat-qa/${editingId}` : '/api/v1/admin/chat-qa';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        await loadQuestions();
      } else {
        alert(data.message || 'Failed to save');
      }
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deactivateQuestion = async (id: string) => {
    if (!confirm('Deactivate this question? It will no longer appear in buyer chats.')) return;
    try {
      const res = await fetch(`/api/v1/admin/chat-qa/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        await loadQuestions();
      } else {
        alert(data.message || 'Failed to deactivate');
      }
    } catch {
      alert('Failed to deactivate');
    }
  };

  const filtered = questions.filter((q) => filter === 'ALL' || q.purpose === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">
            Configure buyer questions and seller answer options for each chat purpose.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Buyers pick a question; sellers reply with one of the answers linked to that question.
            Use <code className="text-emerald-400">[date]</code> in a seller answer to prompt for a date in chat.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Add Question
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'ORDER_STATUS', 'REPEAT_ORDER'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              filter === value
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {value === 'ALL' ? 'All' : PURPOSE_LABELS[value]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No chat questions configured.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <div
              key={q.id}
              className={`glass-card rounded-2xl border p-4 ${
                q.isActive ? 'border-white/10' : 'border-red-500/20 opacity-60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        q.purpose === 'REPEAT_ORDER'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {PURPOSE_LABELS[q.purpose]}
                    </span>
                    {!q.isActive && (
                      <span className="text-[10px] font-bold uppercase text-red-400">Inactive</span>
                    )}
                    <span className="text-[10px] text-slate-500">Sort #{q.sortOrder}</span>
                  </div>
                  <p className="text-sm font-semibold text-white flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    {q.questionText}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Seller answers ({q.answers.filter((a) => a.isActive).length})
                    </p>
                    {q.answers.filter((a) => a.isActive).map((a) => (
                      <p key={a.id || a.label} className="text-xs text-slate-300 pl-3 border-l-2 border-emerald-500/40">
                        {a.label}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(q)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {q.isActive && (
                    <button
                      type="button"
                      onClick={() => deactivateQuestion(q.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Deactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-lg w-full bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Edit Question' : 'New Question'}
              </h3>
              <button type="button" onClick={() => !saving && setShowForm(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Chat purpose</label>
                <select
                  value={form.purpose}
                  onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value as ChatPurpose }))}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  <option value="ORDER_STATUS">Order Status</option>
                  <option value="REPEAT_ORDER">Repeat Order</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Buyer question</label>
                <textarea
                  value={form.questionText}
                  onChange={(e) => setForm((p) => ({ ...p, questionText: e.target.value }))}
                  rows={2}
                  placeholder="What the buyer sees in their dropdown"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Sort order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400 font-semibold">Seller answers</label>
                  <button
                    type="button"
                    onClick={addAnswerRow}
                    className="text-xs text-blue-400 font-semibold hover:text-blue-300"
                  >
                    + Add answer
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">
                  Include <code className="text-emerald-400">[date]</code> where the seller must pick a date (e.g.
                  &quot;Production starts on [date].&quot;).
                </p>
                <div className="space-y-2">
                  {form.answers.map((a, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={a.label}
                        onChange={(e) => updateAnswer(index, e.target.value)}
                        placeholder={`Answer option ${index + 1}`}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                      />
                      {form.answers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAnswer(index)}
                          className="px-2 text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <Button variant="primary" onClick={saveQuestion} loading={saving} className="flex-1">
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
