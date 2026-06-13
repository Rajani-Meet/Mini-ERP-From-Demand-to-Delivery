"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Role, UserStatus } from "@prisma/client";
import {
  Users, Plus, X, Search, Edit, Trash2, KeyRound,
  AlertTriangle, UserCheck, UserX, ShieldAlert, Building2,
  ChevronDown, ChevronUp, RefreshCw, Loader2, Eye, EyeOff,
} from "lucide-react";

interface Company { id: string; name: string; accentColor: string | null }

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  companyId: string;
  company: Company;
  canAccessProducts: boolean;
  canAccessSales: boolean;
  canAccessPurchases: boolean;
  canAccessManufacturing: boolean;
  canAccessBoM: boolean;
  canAccessStockLedger: boolean;
  canAccessAuditLogs: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-500/10 text-red-400 border-red-500/20",
  ADMIN: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  MANAGER: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  OPERATOR: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  VIEWER: "bg-slate-800 text-slate-400 border-[#1E293B]",
};

const MODULE_FLAGS = [
  { key: "canAccessProducts", label: "Products & Inventory" },
  { key: "canAccessSales", label: "Sales Orders" },
  { key: "canAccessPurchases", label: "Purchase Orders" },
  { key: "canAccessManufacturing", label: "Manufacturing Orders" },
  { key: "canAccessBoM", label: "Bill of Materials" },
  { key: "canAccessStockLedger", label: "Stock Ledger" },
  { key: "canAccessAuditLogs", label: "Audit Logs" },
] as const;

type DrawerMode = "create" | "edit" | "reset-password" | null;

export default function SuperAdminUsersPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [sortField, setSortField] = useState<"name" | "role" | "status" | "company" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<Role>(Role.VIEWER);
  const [formStatus, setFormStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>({
    canAccessProducts: true, canAccessSales: true, canAccessPurchases: true,
    canAccessManufacturing: true, canAccessBoM: true, canAccessStockLedger: true, canAccessAuditLogs: true,
  });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch("/api/super-admin/users"),
        fetch("/api/super-admin/companies"),
      ]);
      const [usersData, companiesData] = await Promise.all([usersRes.json(), companiesRes.json()]);
      if (usersData.success) setUsers(usersData.data);
      if (companiesData.success) setCompanies(companiesData.data.map((c: { id: string; name: string; accentColor: string | null }) => ({ id: c.id, name: c.name, accentColor: c.accentColor })));
    } catch {
      setError("Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === "SUPER_ADMIN") fetchAll();
  }, [userRole, fetchAll]);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t); }
  }, [success]);

  if (userRole !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center max-w-md mx-auto">
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl"><ShieldAlert className="w-12 h-12" /></div>
        <h2 className="text-xl font-bold text-slate-100">Access Denied</h2>
        <p className="text-sm text-slate-400">Super Admin access required.</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditingUser(null); setDrawerMode("create"); setError(null);
    setFormName(""); setFormEmail(""); setFormPassword(""); setShowPassword(false);
    setFormRole(Role.VIEWER); setFormStatus(UserStatus.ACTIVE);
    setFormCompanyId(companies[0]?.id ?? "");
    setFormPerms({ canAccessProducts: true, canAccessSales: true, canAccessPurchases: true, canAccessManufacturing: true, canAccessBoM: true, canAccessStockLedger: true, canAccessAuditLogs: true });
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u); setDrawerMode("edit"); setError(null);
    setFormName(u.name); setFormEmail(u.email); setFormRole(u.role); setFormStatus(u.status); setFormCompanyId(u.companyId);
    setFormPerms({ canAccessProducts: u.canAccessProducts, canAccessSales: u.canAccessSales, canAccessPurchases: u.canAccessPurchases, canAccessManufacturing: u.canAccessManufacturing, canAccessBoM: u.canAccessBoM, canAccessStockLedger: u.canAccessStockLedger, canAccessAuditLogs: u.canAccessAuditLogs });
    setFormPassword(""); setShowPassword(false);
  };

  const openResetPassword = (u: UserItem) => {
    setEditingUser(u); setDrawerMode("reset-password"); setError(null);
    setFormPassword(""); setShowPassword(false);
  };

  const closeDrawer = () => { setDrawerMode(null); setEditingUser(null); setError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setIsSaving(true);

    try {
      if (drawerMode === "create") {
        if (!formName.trim() || formName.length < 2) { setError("Name must be at least 2 characters."); setIsSaving(false); return; }
        if (!formEmail.includes("@")) { setError("Enter a valid email."); setIsSaving(false); return; }
        if (!formCompanyId) { setError("Select a company."); setIsSaving(false); return; }
        const res = await fetch("/api/super-admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, email: formEmail, password: formPassword, role: formRole, companyId: formCompanyId, ...formPerms }),
        });
        const data = await res.json();
        if (!data.success) { setError(data.message); setIsSaving(false); return; }
        setSuccess(`User "${formName}" created successfully.`);
      } else if (drawerMode === "edit" && editingUser) {
        const res = await fetch(`/api/super-admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: formRole, status: formStatus, ...formPerms }),
        });
        const data = await res.json();
        if (!data.success) { setError(data.message); setIsSaving(false); return; }
        setSuccess(`User "${editingUser.name}" updated.`);
      } else if (drawerMode === "reset-password" && editingUser) {
        const res = await fetch(`/api/super-admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: formPassword }),
        });
        const data = await res.json();
        if (!data.success) { setError(data.message); setIsSaving(false); return; }
        setSuccess(`Password reset for "${editingUser.name}".`);
      }
      closeDrawer();
      fetchAll();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const res = await fetch(`/api/super-admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { setSuccess("User deleted."); fetchAll(); }
      else setError(data.message);
    } catch { setError("Delete failed."); }
    finally { setDeleteConfirm(null); }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const sortedUsers = [...users]
    .filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
      const matchCompany = filterCompany === "all" || u.companyId === filterCompany;
      const matchRole = filterRole === "all" || u.role === filterRole;
      return matchSearch && matchCompany && matchRole;
    })
    .sort((a, b) => {
      const f = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return a.name.localeCompare(b.name) * f;
      if (sortField === "role") return a.role.localeCompare(b.role) * f;
      if (sortField === "status") return a.status.localeCompare(b.status) * f;
      if (sortField === "company") return a.company.name.localeCompare(b.company.name) * f;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * f;
    });

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null;

  const isDrawerOpen = drawerMode !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <Users className="w-8 h-8 text-amber-500" />
            User Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage all users across every tenant company</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="p-2.5 rounded-xl border border-[#1E293B] text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openCreate} id="btn-create-user"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all text-xs shadow-lg shadow-amber-500/10">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <UserCheck className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}
      {error && !isDrawerOpen && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 p-4 rounded-xl flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search by name, email or role..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600 transition-all" />
        </div>
        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}
          className="bg-[#07080C] border border-[#1E293B] text-slate-300 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none min-w-[160px]">
          <option value="all">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="bg-[#07080C] border border-[#1E293B] text-slate-300 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none">
          <option value="all">All Roles</option>
          {Object.values(Role).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, color: "text-slate-100" },
          { label: "Active", value: users.filter(u => u.status === "ACTIVE").length, color: "text-emerald-400" },
          { label: "Inactive", value: users.filter(u => u.status === "INACTIVE").length, color: "text-red-400" },
          { label: "Companies", value: companies.length, color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-4 text-center">
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <span className="text-xs font-mono">Loading users...</span>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono">No users match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-400 font-mono">
                  {[
                    { label: "Name", field: "name" as const },
                    { label: "Email", field: null },
                    { label: "Company", field: "company" as const },
                    { label: "Role", field: "role" as const },
                    { label: "Status", field: "status" as const },
                    { label: "Created", field: "date" as const },
                  ].map(({ label, field }) => (
                    <th key={label}
                      className={`p-4 ${field ? "cursor-pointer hover:bg-slate-900 transition-colors" : ""}`}
                      onClick={() => field && handleSort(field)}>
                      <div className="flex items-center gap-1.5">{label} {field && <SortIcon field={field} />}</div>
                    </th>
                  ))}
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40 text-slate-300">
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#07080C]/40 transition-colors group">
                    <td className="p-4 font-semibold text-slate-100">
                      <div className="flex items-center gap-2">
                        {u.name}
                        {u.id === session?.user?.id && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-mono uppercase font-bold">You</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-400">{u.email}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: u.company.accentColor ?? "#6366f1" }} />
                        <span className="text-slate-300 text-[11px]">{u.company.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${ROLE_COLORS[u.role] ?? ROLE_COLORS.VIEWER}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {u.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 font-mono">
                          <UserCheck className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-transparent font-mono">
                          <UserX className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 font-mono">
                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(u)} title="Edit user"
                          className="p-1.5 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-lg text-slate-400 hover:text-amber-500 transition-all">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openResetPassword(u)} title="Reset password"
                          className="p-1.5 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-lg text-slate-400 hover:text-blue-400 transition-all">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== session?.user?.id && (
                          <button onClick={() => setDeleteConfirm(u.id)} title="Delete user"
                            className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0E111A] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400"><Trash2 className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Confirm Delete</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">Are you sure you want to permanently delete this user? Their audit log entries will be preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 text-xs font-semibold text-slate-300 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-all active:scale-95">Delete User</button>
            </div>
          </div>
        </div>
      )}

      {/* Right Drawer */}
      <div className={`fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={closeDrawer}>
        <div className={`w-full max-w-md h-full bg-[#0E111A] border-l border-[#1E293B] shadow-2xl flex flex-col transition-transform duration-300 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
          onClick={(e) => e.stopPropagation()}>

          {/* Drawer Header */}
          <div className="p-5 border-b border-[#1E293B] flex justify-between items-start">
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {drawerMode === "create" && "Add New User"}
                {drawerMode === "edit" && `Edit: ${editingUser?.name}`}
                {drawerMode === "reset-password" && `Reset Password`}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {drawerMode === "create" && "Create a new user in any tenant company"}
                {drawerMode === "edit" && `Editing user in ${editingUser?.company.name}`}
                {drawerMode === "reset-password" && `Set a new password for ${editingUser?.name}`}
              </p>
            </div>
            <button onClick={closeDrawer} className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-[#1E293B] rounded-lg transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error in Drawer */}
          {error && (
            <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Drawer Body */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* CREATE / EDIT fields */}
            {drawerMode === "create" && (
              <>
                {/* Company Select */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Assign to Company
                  </label>
                  <select value={formCompanyId} onChange={(e) => setFormCompanyId(e.target.value)}
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    <option value="">— Select Company —</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Full Name</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. John Doe"
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Email Address</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. john@company.com"
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Initial Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Min 8 chars (A-Z, a-z, 0-9, symbol)"
                      className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 pr-10 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* RESET PASSWORD */}
            {drawerMode === "reset-password" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">New Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Min 8 chars (A-Z, a-z, 0-9, symbol)"
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 pr-10 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">Must include uppercase, lowercase, number, and special character.</p>
              </div>
            )}

            {/* Role (create + edit) */}
            {drawerMode !== "reset-password" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Authorization Role</label>
                <select value={formRole} onChange={(e) => setFormRole(e.target.value as Role)}
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none">
                  <option value={Role.VIEWER}>Viewer (Read Only)</option>
                  <option value={Role.OPERATOR}>Operator (Manufacturing & Stock)</option>
                  <option value={Role.MANAGER}>Manager (Full Operations)</option>
                  <option value={Role.ADMIN}>Admin (Company Super User)</option>
                </select>
              </div>
            )}

            {/* Status (edit only) */}
            {drawerMode === "edit" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Account Status</label>
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none">
                  <option value={UserStatus.ACTIVE}>Active</option>
                  <option value={UserStatus.INACTIVE}>Inactive (Blocked)</option>
                </select>
              </div>
            )}

            {/* Module Permissions (create + edit, not for Admin roles) */}
            {drawerMode !== "reset-password" && formRole !== Role.ADMIN && (
              <div className="space-y-3 pt-2 border-t border-[#1E293B]/50">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Module Access</h4>
                <div className="grid grid-cols-1 gap-2 bg-[#07080C] p-4 rounded-xl border border-[#1E293B]">
                  {MODULE_FLAGS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                      <input type="checkbox" checked={!!formPerms[key]}
                        onChange={(e) => setFormPerms((p) => ({ ...p, [key]: e.target.checked }))}
                        className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer accent-amber-500" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form>

          {/* Drawer Footer */}
          <div className="p-5 border-t border-[#1E293B] bg-[#0E111A] flex gap-3">
            <button type="button" onClick={closeDrawer}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300 font-mono">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold transition-all active:scale-95 text-xs font-mono flex items-center justify-center gap-2">
              {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> :
                drawerMode === "create" ? "Create User" :
                drawerMode === "edit" ? "Update User" : "Reset Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
