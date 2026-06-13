"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Mail,
  Phone,
  Search,
} from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

interface VendorFormData {
  name: string;
  email: string;
  phone: string;
}

const emptyForm: VendorFormData = { name: "", email: "", phone: "" };

// ── Modal ──────────────────────────────────────────────────────────────────────
function VendorModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Vendor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<VendorFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(editing ? { name: editing.name, email: editing.email, phone: editing.phone } : emptyForm);
      setError(null);
    }
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/vendors/${editing.id}` : "/api/vendors",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.message || "Failed to save vendor.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0E111A] border border-[#1E293B] rounded-2xl shadow-2xl shadow-black/60 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
            {editing ? "Edit Vendor" : "New Vendor"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Vendor Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Supplies"
              required
              className="w-full bg-[#07080C] border border-[#1E293B] hover:border-emerald-500/30 focus:border-emerald-500 text-slate-200 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:outline-none placeholder-slate-600 transition-all"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="vendor@example.com"
              required
              className="w-full bg-[#07080C] border border-[#1E293B] hover:border-emerald-500/30 focus:border-emerald-500 text-slate-200 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:outline-none placeholder-slate-600 transition-all"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Phone <span className="text-rose-400">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              required
              className="w-full bg-[#07080C] border border-[#1E293B] hover:border-emerald-500/30 focus:border-emerald-500 text-slate-200 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:outline-none placeholder-slate-600 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#1E293B] hover:bg-slate-900 text-xs font-semibold text-slate-300 font-mono transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs font-mono transition-all active:scale-95"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors");
      const data = await res.json();
      if (data.success) setVendors(data.data);
      else setError(data.message || "Failed to load vendors.");
    } catch {
      setError("Network error.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return;
    setDeleting(vendor.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Vendor "${vendor.name}" deleted.`);
        await fetchVendors();
      } else {
        setError(data.message || "Failed to delete vendor.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setDeleting(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setModalOpen(true);
  };

  const filtered = vendors.filter(
    (v) =>
      !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.email.toLowerCase().includes(search.toLowerCase()) ||
      v.phone.includes(search)
  );

  return (
    <>
      <VendorModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          fetchVendors();
          setSuccess(editing ? "Vendor updated." : "Vendor created.");
        }}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
              <Truck className="w-6 h-6 text-emerald-400" />
              Vendors
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your supplier directory.
            </p>
          </div>
          <button
            onClick={openCreate}
            id="btn-new-vendor"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-600/20 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Vendor
          </button>
        </div>

        {/* Notifications */}
        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0E111A] border border-[#1E293B] text-slate-200 text-xs pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500/50 placeholder-slate-600 transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm font-mono gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading vendors…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-600">
              <Truck className="w-8 h-8 opacity-30" />
              <p className="text-sm font-semibold">
                {search ? "No vendors match your search." : "No vendors yet. Add your first supplier."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-500 font-mono uppercase text-[10px]">
                    <th className="px-5 py-3 text-left">Vendor</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Phone</th>
                    <th className="px-5 py-3 text-left">Added</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/30">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-[#07080C]/50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
                            {v.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-200">{v.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          {v.email}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-slate-400 font-mono">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {v.phone}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-mono">
                        {new Date(v.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(v)}
                            id={`btn-edit-vendor-${v.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                            title="Edit vendor"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(v)}
                            disabled={deleting === v.id}
                            id={`btn-delete-vendor-${v.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all disabled:opacity-40"
                            title="Delete vendor"
                          >
                            {deleting === v.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Count */}
        {!isLoading && filtered.length > 0 && (
          <p className="text-[11px] text-slate-600 font-mono text-right">
            {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
          </p>
        )}
      </div>
    </>
  );
}
