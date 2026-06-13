"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Role, UserStatus } from "@prisma/client";
import {
  Building2, Plus, X, Search, AlertTriangle, ShieldCheck, Mail, Lock,
  Loader2, Calendar, User, ChevronDown, ChevronUp, Users, Edit, Trash2,
  KeyRound, UserCheck, UserX, Eye, EyeOff, RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  canAccessProducts: boolean;
  canAccessSales: boolean;
  canAccessPurchases: boolean;
  canAccessManufacturing: boolean;
  canAccessBoM: boolean;
  canAccessStockLedger: boolean;
  canAccessAuditLogs: boolean;
}

interface CompanyItem {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  createdAt: string;
  users: UserItem[];
}

type DrawerMode = "provision" | "add-user" | "edit-user" | "reset-password" | null;

const ROLE_COLORS: Record<string, string> = {
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

// ─── Page Component ───────────────────────────────────────────────────────────

export default function SuperAdminCompaniesPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; companyId: string } | null>(null);

  // Drawer state
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Provision form
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // User form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<Role>(Role.VIEWER);
  const [formStatus, setFormStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>({
    canAccessProducts: true, canAccessSales: true, canAccessPurchases: true,
    canAccessManufacturing: true, canAccessBoM: true, canAccessStockLedger: true, canAccessAuditLogs: true,
  });

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const [companiesRes, usersRes] = await Promise.all([
        fetch("/api/super-admin/companies"),
        fetch("/api/super-admin/users"),
      ]);
      const [companiesData, usersData] = await Promise.all([companiesRes.json(), usersRes.json()]);
      if (companiesData.success && usersData.success) {
        const usersByCompany: Record<string, UserItem[]> = {};
        for (const u of usersData.data) {
          if (!usersByCompany[u.companyId]) usersByCompany[u.companyId] = [];
          usersByCompany[u.companyId].push(u);
        }
        setCompanies(companiesData.data.map((c: CompanyItem) => ({
          ...c,
          users: usersByCompany[c.id] ?? [],
        })));
      } else {
        setErrorMessage(companiesData.message || "Failed to fetch data.");
      }
    } catch {
      setErrorMessage("Failed to load data. Please reload.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === "SUPER_ADMIN") fetchCompanies();
  }, [userRole, fetchCompanies]);

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  if (userRole !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4 max-w-md mx-auto">
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Access Denied</h2>
        <p className="text-sm text-slate-400">Super Administrator access required.</p>
      </div>
    );
  }

  // ─── Drawer Openers ──────────────────────────────────────────────────────

  const openProvision = () => {
    setCompanyName(""); setAdminName(""); setAdminEmail(""); setAdminPassword("");
    setErrorMessage(null); setDrawerMode("provision");
  };

  const openAddUser = (companyId: string) => {
    setActiveCompanyId(companyId); setEditingUser(null);
    setFormName(""); setFormEmail(""); setFormPassword(""); setShowPassword(false);
    setFormRole(Role.VIEWER); setFormStatus(UserStatus.ACTIVE);
    setFormPerms({ canAccessProducts: true, canAccessSales: true, canAccessPurchases: true, canAccessManufacturing: true, canAccessBoM: true, canAccessStockLedger: true, canAccessAuditLogs: true });
    setErrorMessage(null); setDrawerMode("add-user");
  };

  const openEditUser = (user: UserItem, companyId: string) => {
    setActiveCompanyId(companyId); setEditingUser(user);
    setFormName(user.name); setFormEmail(user.email);
    setFormRole(user.role as Role); setFormStatus(user.status as UserStatus);
    setFormPassword(""); setShowPassword(false);
    setFormPerms({
      canAccessProducts: user.canAccessProducts, canAccessSales: user.canAccessSales,
      canAccessPurchases: user.canAccessPurchases, canAccessManufacturing: user.canAccessManufacturing,
      canAccessBoM: user.canAccessBoM, canAccessStockLedger: user.canAccessStockLedger,
      canAccessAuditLogs: user.canAccessAuditLogs,
    });
    setErrorMessage(null); setDrawerMode("edit-user");
  };

  const openResetPassword = (user: UserItem, companyId: string) => {
    setActiveCompanyId(companyId); setEditingUser(user);
    setFormPassword(""); setShowPassword(false);
    setErrorMessage(null); setDrawerMode("reset-password");
  };

  const closeDrawer = () => { setDrawerMode(null); setEditingUser(null); setActiveCompanyId(null); setErrorMessage(null); };

  // ─── Submit Handlers ─────────────────────────────────────────────────────

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!companyName || companyName.trim().length < 2) { setErrorMessage("Company name must be at least 2 characters."); return; }
    if (!adminName || adminName.trim().length < 2) { setErrorMessage("Admin name must be at least 2 characters."); return; }
    if (!adminEmail || !adminEmail.includes("@")) { setErrorMessage("Please enter a valid email address."); return; }
    if (!adminPassword || adminPassword.length < 8) { setErrorMessage("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(adminPassword)) { setErrorMessage("Password must contain at least one uppercase letter."); return; }
    if (!/[a-z]/.test(adminPassword)) { setErrorMessage("Password must contain at least one lowercase letter."); return; }
    if (!/[0-9]/.test(adminPassword)) { setErrorMessage("Password must contain at least one number."); return; }
    if (!/[^a-zA-Z0-9]/.test(adminPassword)) { setErrorMessage("Password must contain at least one special character."); return; }
    setIsSaving(true);
    try {
      const res = await fetch("/api/super-admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, adminName, adminEmail, adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Company tenant and Admin profile provisioned successfully!");
        closeDrawer(); fetchCompanies();
      } else {
        setErrorMessage(data.message || "Failed to provision company.");
      }
    } catch { setErrorMessage("An error occurred. Please try again."); }
    finally { setIsSaving(false); }
  };

  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); setIsSaving(true);
    try {
      if (drawerMode === "add-user") {
        if (!formName.trim() || formName.length < 2) { setErrorMessage("Name must be at least 2 characters."); setIsSaving(false); return; }
        if (!formEmail.includes("@")) { setErrorMessage("Enter a valid email."); setIsSaving(false); return; }
        const res = await fetch("/api/super-admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, email: formEmail, password: formPassword, role: formRole, companyId: activeCompanyId, ...formPerms }),
        });
        const data = await res.json();
        if (!data.success) { setErrorMessage(data.message); setIsSaving(false); return; }
        setSuccessMessage(`User "${formName}" added successfully.`);
      } else if (drawerMode === "edit-user" && editingUser) {
        const res = await fetch(`/api/super-admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: formRole, status: formStatus, ...formPerms }),
        });
        const data = await res.json();
        if (!data.success) { setErrorMessage(data.message); setIsSaving(false); return; }
        setSuccessMessage(`User "${editingUser.name}" updated.`);
      } else if (drawerMode === "reset-password" && editingUser) {
        const res = await fetch(`/api/super-admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: formPassword }),
        });
        const data = await res.json();
        if (!data.success) { setErrorMessage(data.message); setIsSaving(false); return; }
        setSuccessMessage(`Password reset for "${editingUser.name}".`);
      }
      closeDrawer(); fetchCompanies();
    } catch { setErrorMessage("An error occurred. Please try again."); }
    finally { setIsSaving(false); }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/super-admin/users/${deleteConfirm.userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { setSuccessMessage("User deleted."); fetchCompanies(); }
      else setErrorMessage(data.message);
    } catch { setErrorMessage("Delete failed."); }
    finally { setDeleteConfirm(null); }
  };

  // ─── Sort & Filter ───────────────────────────────────────────────────────

  const handleSort = (field: "name" | "date") => {
    if (sortField === field) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("asc"); }
  };

  const sortedCompanies = [...companies]
    .filter((c) => {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.users.some(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const f = sortDirection === "asc" ? 1 : -1;
      if (sortField === "name") return a.name.localeCompare(b.name) * f;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * f;
    });

  const isDrawerOpen = drawerMode !== null;
  const isUserDrawer = drawerMode === "add-user" || drawerMode === "edit-user" || drawerMode === "reset-password";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-amber-500" />
            System Tenant Administration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Provision company accounts and manage their users directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCompanies} className="p-2.5 rounded-xl border border-[#1E293B] text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openProvision} id="btn-provision-company"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all text-xs shadow-lg shadow-amber-500/10">
            <Plus className="w-4 h-4" /> Provision Company
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" /> {successMessage}
        </div>
      )}
      {errorMessage && !isDrawerOpen && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errorMessage}
        </div>
      )}

      {/* Search */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 p-4 rounded-xl">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search by company name or user details..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600 transition-all" />
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <span className="text-xs font-mono">Loading tenants...</span>
          </div>
        ) : sortedCompanies.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono">No registered company tenants found.</div>
        ) : (
          <>
            {/* Table Header */}
            <div className="bg-[#07080C] border-b border-[#1E293B] px-4 py-3 grid grid-cols-3 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              <button className="flex items-center gap-1.5 text-left hover:text-slate-200 transition-colors" onClick={() => handleSort("name")}>
                Company Name {sortField === "name" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
              </button>
              <span className="hidden sm:block">Primary Admin</span>
              <button className="flex items-center gap-1.5 justify-end hover:text-slate-200 transition-colors" onClick={() => handleSort("date")}>
                {sortField === "date" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null} Provisioned
              </button>
            </div>

            <div className="divide-y divide-[#1E293B]/40">
              {sortedCompanies.map((comp) => {
                const isExpanded = expandedCompany === comp.id;
                const accentColor = comp.accentColor ?? "#6366f1";
                const primaryAdmin = comp.users.find(u => u.role === "ADMIN");

                return (
                  <div key={comp.id}>
                    {/* Company Row */}
                    <button
                      className="w-full px-4 py-4 grid grid-cols-3 items-center hover:bg-[#07080C]/60 transition-colors text-left group"
                      onClick={() => setExpandedCompany(isExpanded ? null : comp.id)}
                    >
                      {/* Company name + avatar */}
                      <div className="flex items-center gap-3">
                        {comp.logoUrl ? (
                          <img src={comp.logoUrl} alt={comp.name} className="w-7 h-7 object-contain rounded border border-[#1E293B]" />
                        ) : (
                          <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-[11px] border flex-shrink-0"
                            style={{ backgroundColor: accentColor + "22", borderColor: accentColor + "44", color: accentColor }}>
                            {comp.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-100 text-sm">{comp.name}</p>
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" /> {comp.users.length} user{comp.users.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      {/* Primary admin */}
                      <div className="hidden sm:flex items-center gap-1.5">
                        {primaryAdmin ? (
                          <>
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <div>
                              <p className="text-xs text-slate-200 font-medium">{primaryAdmin.name}</p>
                              <p className="text-[10px] font-mono text-slate-500">{primaryAdmin.email}</p>
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">No admin</span>
                        )}
                      </div>

                      {/* Date + expand */}
                      <div className="flex items-center justify-end gap-3">
                        <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                          <Calendar className="w-3 h-3" />
                          {new Date(comp.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                        <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>

                    {/* Expanded: User Management Panel */}
                    {isExpanded && (
                      <div className="border-t border-[#1E293B]/60 bg-[#07080C]/40">
                        {/* Panel Header */}
                        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                              Users — {comp.name}
                            </span>
                            <span className="text-[10px] font-mono bg-[#1E293B] text-slate-400 px-2 py-0.5 rounded">
                              {comp.users.length}
                            </span>
                          </div>
                          <button
                            onClick={() => openAddUser(comp.id)}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 px-3 py-1.5 rounded-lg transition-all"
                          >
                            <Plus className="w-3 h-3" /> Add User
                          </button>
                        </div>

                        {/* Users Table */}
                        {comp.users.length === 0 ? (
                          <div className="px-4 pb-4 text-xs text-slate-600 font-mono">No users in this company.</div>
                        ) : (
                          <div className="overflow-x-auto pb-3">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                                  <th className="px-4 py-2">Name</th>
                                  <th className="px-4 py-2 hidden sm:table-cell">Email</th>
                                  <th className="px-4 py-2">Role</th>
                                  <th className="px-4 py-2">Status</th>
                                  <th className="px-4 py-2 hidden md:table-cell">Joined</th>
                                  <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#1E293B]/20">
                                {comp.users.map((u) => (
                                  <tr key={u.id} className="hover:bg-[#0E111A]/60 transition-colors group">
                                    <td className="px-4 py-2.5 font-semibold text-slate-200">
                                      <div className="flex items-center gap-1.5">
                                        {u.name}
                                        {u.id === session?.user?.id && (
                                          <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1 py-0.5 rounded font-mono uppercase font-bold">You</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-slate-500 hidden sm:table-cell">{u.email}</td>
                                    <td className="px-4 py-2.5">
                                      <span className={`inline-block text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${ROLE_COLORS[u.role] ?? ROLE_COLORS.VIEWER}`}>
                                        {u.role}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      {u.status === "ACTIVE" ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 font-mono">
                                          <UserCheck className="w-2.5 h-2.5" /> Active
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-transparent font-mono">
                                          <UserX className="w-2.5 h-2.5" /> Inactive
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px] hidden md:table-cell">
                                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditUser(u, comp.id)} title="Edit user"
                                          className="p-1.5 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-lg text-slate-400 hover:text-amber-500 transition-all">
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => openResetPassword(u, comp.id)} title="Reset password"
                                          className="p-1.5 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-lg text-slate-400 hover:text-blue-400 transition-all">
                                          <KeyRound className="w-3 h-3" />
                                        </button>
                                        {u.id !== session?.user?.id && (
                                          <button onClick={() => setDeleteConfirm({ userId: u.id, companyId: comp.id })} title="Delete user"
                                            className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all">
                                            <Trash2 className="w-3 h-3" />
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
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
            <p className="text-xs text-slate-300">Permanently delete this user? Their audit log entries will be preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 text-xs font-semibold text-slate-300 transition-colors">Cancel</button>
              <button onClick={handleDeleteUser}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-all active:scale-95">Delete User</button>
            </div>
          </div>
        </div>
      )}

      {/* Right Drawer */}
      <div
        className={`fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={closeDrawer}
      >
        <div
          className={`w-full max-w-md h-full bg-[#0E111A] border-l border-[#1E293B] shadow-2xl flex flex-col transition-transform duration-300 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-[#1E293B] flex justify-between items-start">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {drawerMode === "provision" && <><Building2 className="w-4 h-4 text-amber-500" /> Provision Company Tenant</>}
                {drawerMode === "add-user" && <><Plus className="w-4 h-4 text-amber-500" /> Add User</>}
                {drawerMode === "edit-user" && <><Edit className="w-4 h-4 text-amber-500" /> Edit: {editingUser?.name}</>}
                {drawerMode === "reset-password" && <><KeyRound className="w-4 h-4 text-amber-500" /> Reset Password</>}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {drawerMode === "provision" && "Set up a new isolated customer workspace and admin account."}
                {drawerMode === "add-user" && `Adding user to ${companies.find(c => c.id === activeCompanyId)?.name}`}
                {drawerMode === "edit-user" && `Editing user in ${companies.find(c => c.id === activeCompanyId)?.name}`}
                {drawerMode === "reset-password" && `Set a new password for ${editingUser?.name}`}
              </p>
            </div>
            <button onClick={closeDrawer} className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-[#1E293B] rounded-lg transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error in Drawer */}
          {errorMessage && (
            <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {errorMessage}
            </div>
          )}

          {/* Drawer Body */}
          <form onSubmit={drawerMode === "provision" ? handleProvisionSubmit : handleUserSave} className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* ── PROVISION COMPANY FORM ── */}
            {drawerMode === "provision" && (
              <>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-[#1E293B]/50 pb-2">Company Metadata</h4>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Shiv Furniture Works"
                      className="w-full pl-9 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600" />
                  </div>
                </div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-[#1E293B]/50 pb-2 pt-2">Company Admin Credentials</h4>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Admin Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Shiv Kumar"
                      className="w-full pl-9 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="e.g. admin@shivfurniture.com"
                      className="w-full pl-9 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Admin Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Min 8 chars (A-Z, a-z, 0-9, symbol)"
                      className="w-full pl-9 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600" />
                  </div>
                </div>
              </>
            )}

            {/* ── ADD / EDIT USER FORM ── */}
            {(drawerMode === "add-user" || drawerMode === "edit-user") && (
              <>
                {drawerMode === "add-user" && (
                  <>
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

                {drawerMode === "edit-user" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">Account Status</label>
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                      className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none">
                      <option value={UserStatus.ACTIVE}>Active</option>
                      <option value={UserStatus.INACTIVE}>Inactive (Blocked)</option>
                    </select>
                  </div>
                )}

                {formRole !== Role.ADMIN && (
                  <div className="space-y-3 pt-2 border-t border-[#1E293B]/50">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Module Access</h4>
                    <div className="grid grid-cols-1 gap-2 bg-[#07080C] p-4 rounded-xl border border-[#1E293B]">
                      {MODULE_FLAGS.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                          <input type="checkbox" checked={!!formPerms[key]}
                            onChange={(e) => setFormPerms(p => ({ ...p, [key]: e.target.checked }))}
                            className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer accent-amber-500" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── RESET PASSWORD FORM ── */}
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
          </form>

          {/* Drawer Footer */}
          <div className="p-5 border-t border-[#1E293B] bg-[#0E111A] flex gap-3">
            <button type="button" onClick={closeDrawer}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300 font-mono">
              Cancel
            </button>
            <button type="button" onClick={drawerMode === "provision" ? handleProvisionSubmit : handleUserSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold transition-all active:scale-95 text-xs font-mono flex items-center justify-center gap-2">
              {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> :
                drawerMode === "provision" ? <><ShieldCheck className="w-3.5 h-3.5" /> Provision Tenant</> :
                drawerMode === "add-user" ? "Create User" :
                drawerMode === "edit-user" ? "Update User" : "Reset Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
