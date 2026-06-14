"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Role, UserStatus } from "@prisma/client";
import {
  Users,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  UserCheck,
  UserX,
  Edit,
  ShieldAlert,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  canAccessProducts?: boolean;
  canAccessSales?: boolean;
  canAccessPurchases?: boolean;
  canAccessManufacturing?: boolean;
  canAccessBoM?: boolean;
  canAccessStockLedger?: boolean;
  canAccessAuditLogs?: boolean;
}

export default function UserManagementPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const userRole = session?.user?.role as Role;

  // State Management
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search/Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "email" | "role" | "status" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.VIEWER);
  const [status, setStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [password, setPassword] = useState("");
  const [canAccessProducts, setCanAccessProducts] = useState(true);
  const [canAccessSales, setCanAccessSales] = useState(true);
  const [canAccessPurchases, setCanAccessPurchases] = useState(true);
  const [canAccessManufacturing, setCanAccessManufacturing] = useState(true);
  const [canAccessBoM, setCanAccessBoM] = useState(true);
  const [canAccessStockLedger, setCanAccessStockLedger] = useState(true);
  const [canAccessAuditLogs, setCanAccessAuditLogs] = useState(true);

  // Fetch users
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users");
      const resData = await response.json();
      if (resData.success) {
        setUsers(resData.data);
      } else {
        setErrorMessage(resData.message || "Failed to fetch users.");
      }
    } catch (error) {
      console.error("Failed to load users:", error);
      setErrorMessage("Failed to load users. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === Role.ADMIN || userRole === "SUPER_ADMIN" as Role) {
      fetchUsers();
    }
  }, [userRole]);

  // Guard: Admin-only access
  if (userRole !== Role.ADMIN && userRole !== "SUPER_ADMIN" as Role) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4 max-w-md mx-auto">
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Access Denied</h2>
        <p className="text-sm text-slate-400">
          The User Access Control terminal is restricted to Administrator roles only.
        </p>
      </div>
    );
  }

  // Form actions
  const openNewDrawer = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setRole(Role.VIEWER);
    setStatus(UserStatus.ACTIVE);
    setPassword("");
    setCanAccessProducts(true);
    setCanAccessSales(true);
    setCanAccessPurchases(true);
    setCanAccessManufacturing(true);
    setCanAccessBoM(true);
    setCanAccessStockLedger(true);
    setCanAccessAuditLogs(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (user: UserItem) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setStatus(user.status);
    setPassword(""); // Leave blank when editing
    setCanAccessProducts(user.canAccessProducts ?? true);
    setCanAccessSales(user.canAccessSales ?? true);
    setCanAccessPurchases(user.canAccessPurchases ?? true);
    setCanAccessManufacturing(user.canAccessManufacturing ?? true);
    setCanAccessBoM(user.canAccessBoM ?? true);
    setCanAccessStockLedger(user.canAccessStockLedger ?? true);
    setCanAccessAuditLogs(user.canAccessAuditLogs ?? true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validations
    if (!name || name.trim().length < 2) {
      setErrorMessage("Name must be at least 2 characters.");
      return;
    }

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    // Creating validations
    if (!editingUser) {
      if (!password) {
        setErrorMessage("Password is required for new users.");
        return;
      }
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setErrorMessage("Password must contain at least one uppercase letter.");
        return;
      }
      if (!/[a-z]/.test(password)) {
        setErrorMessage("Password must contain at least one lowercase letter.");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setErrorMessage("Password must contain at least one number.");
        return;
      }
      if (!/[^a-zA-Z0-9]/.test(password)) {
        setErrorMessage("Password must contain at least one special character.");
        return;
      }
    }

    // Self-edit check
    if (editingUser && editingUser.id === currentUserId) {
      if (status === UserStatus.INACTIVE || (role !== Role.ADMIN && role !== "SUPER_ADMIN" as Role)) {
        setErrorMessage("Safety Constraint: You cannot demote or deactivate your own admin session.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const payload = editingUser
        ? {
            role,
            status,
            canAccessProducts,
            canAccessSales,
            canAccessPurchases,
            canAccessManufacturing,
            canAccessBoM,
            canAccessStockLedger,
            canAccessAuditLogs,
          }
        : {
            name,
            email,
            role,
            password,
            canAccessProducts,
            canAccessSales,
            canAccessPurchases,
            canAccessManufacturing,
            canAccessBoM,
            canAccessStockLedger,
            canAccessAuditLogs,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (resData.success) {
        setSuccessMessage(
          editingUser ? "User updated successfully!" : "User invited and credentials created!"
        );
        setIsDrawerOpen(false);
        fetchUsers();
      } else {
        setErrorMessage(resData.message || "Failed to submit user updates.");
      }
    } catch (error) {
      console.error("Save error:", error);
      setErrorMessage("An error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Sorting
  const handleSort = (field: "name" | "email" | "role" | "status" | "date") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedUsers = [...users]
    .filter((user) => {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const factor = sortDirection === "asc" ? 1 : -1;
      if (sortField === "name") {
        return a.name.localeCompare(b.name) * factor;
      }
      if (sortField === "email") {
        return a.email.localeCompare(b.email) * factor;
      }
      if (sortField === "role") {
        return a.role.localeCompare(b.role) * factor;
      }
      if (sortField === "status") {
        return a.status.localeCompare(b.status) * factor;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
    });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <Users className="w-8 h-8 text-amber-500" />
            User Access Control (RBAC)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage console user roles, security authorization matrix, and tenant accounts.
          </p>
        </div>
        <button
          onClick={openNewDrawer}
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/10 text-xs"
          id="btn-invite-user"
        >
          <Plus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="flex items-center gap-3 bg-[#0E111A] border border-[#1E293B]/60 p-4 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#07080C] border border-[#1E293B] hover:border-[#1E293B]/80 text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600 font-medium transition-all"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono">
            Loading tenant users...
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono">
            No matching users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-400 font-mono">
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1.5">
                      Name
                      {sortField === "name" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center gap-1.5">
                      Email
                      {sortField === "email" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("role")}
                  >
                    <div className="flex items-center gap-1.5">
                      Assigned Role
                      {sortField === "role" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1.5">
                      Account Status
                      {sortField === "status" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1.5">
                      Registered Date
                      {sortField === "date" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40 text-slate-300">
                {sortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#07080C]/40 transition-colors">
                    <td className="p-4 font-semibold text-slate-100 flex items-center gap-2">
                      {user.name}
                      {user.id === currentUserId && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1 py-0.2 rounded font-mono uppercase font-bold">
                          You
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-400">{user.email}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
                          user.role === ("SUPER_ADMIN" as Role)
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : user.role === Role.ADMIN
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : user.role === Role.MANAGER
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : user.role === Role.OPERATOR
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-slate-800 text-slate-400 border-[#1E293B]"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {user.status === UserStatus.ACTIVE ? (
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
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openEditDrawer(user)}
                        className="p-2 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-lg text-slate-400 hover:text-amber-500 transition-all"
                        title="Edit security parameters"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right Drawer for Inviting or Editing Users */}
      <div
        className={`fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsDrawerOpen(false)}
      >
        <div
          className={`w-full max-w-md h-full bg-[#0E111A] border-l border-[#1E293B] shadow-2xl flex flex-col justify-between transition-transform duration-300 ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-[#1E293B] flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {editingUser ? "Edit User Access" : "Invite Tenant User"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set roles and credential states.
              </p>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-[#1E293B] rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Name input (Read-only if editing) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                User Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!!editingUser}
                placeholder="e.g. John Doe"
                className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Email input (Read-only if editing) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!editingUser}
                placeholder="e.g. john@nexuserp.com"
                className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Password input (Only when creating) */}
            {!editingUser && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Initial Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 chars (A-Z, a-z, 0-9, symbol)"
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            )}

            {/* Role dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Authorization Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value={Role.VIEWER}>Viewer (Read Only)</option>
                <option value={Role.OPERATOR}>Operator (Manufacturing & Stock)</option>
                <option value={Role.MANAGER}>Manager (Full Operations)</option>
                <option value={Role.ADMIN}>Admin (Super User)</option>
              </select>
            </div>

            {/* Status check (Only when editing) */}
            {editingUser && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Account Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserStatus)}
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value={UserStatus.ACTIVE}>Active</option>
                  <option value={UserStatus.INACTIVE}>Inactive (Deactivated)</option>
                </select>
              </div>
            )}

            {/* Feature Access Controls */}
            {role !== Role.ADMIN && role !== "SUPER_ADMIN" as Role && (
              <div className="space-y-3 pt-3 border-t border-[#1E293B]/50">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Allot Access to Functionality
                </h4>
                <div className="grid grid-cols-1 gap-2.5 bg-[#07080C] p-4 rounded-xl border border-[#1E293B]">
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={canAccessProducts}
                      onChange={(e) => setCanAccessProducts(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Products & Inventory Access</span>
                  </label>
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={canAccessSales}
                      onChange={(e) => setCanAccessSales(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Sales Orders Access</span>
                  </label>
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={canAccessPurchases}
                      onChange={(e) => setCanAccessPurchases(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Purchase Orders Access</span>
                  </label>
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={canAccessManufacturing}
                      onChange={(e) => setCanAccessManufacturing(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Manufacturing Orders Access</span>
                  </label>
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={canAccessBoM}
                      onChange={(e) => setCanAccessBoM(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Bill of Materials Access</span>
                  </label>
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={canAccessStockLedger}
                      onChange={(e) => setCanAccessStockLedger(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Stock Ledger Access</span>
                  </label>
                  <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={canAccessAuditLogs}
                      onChange={(e) => setCanAccessAuditLogs(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-slate-700 text-amber-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Audit Logs Access</span>
                  </label>
                </div>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="p-6 border-t border-[#1E293B] bg-[#0E111A] flex gap-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300 font-mono"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold transition-all active:scale-98 text-xs font-mono"
            >
              {isSaving ? "Saving..." : editingUser ? "Update Access" : "Create User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
