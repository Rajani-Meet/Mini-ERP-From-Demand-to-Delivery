"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import { can } from "@/lib/permissions";
import {
  ShieldAlert,
  History,
  Filter,
  User,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";


interface UserSelectorItem {
  id: string;
  name: string;
  email: string;
}

interface AuditLogItem {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  user: {
    name: string;
    email: string;
  } | null;
  createdAt: string;
}

export function AuditLogsContent() {
  const { data: session } = useSession();
  const userRole = (session?.user?.role as Role) || "VIEWER";

  // Check read permission
  const canRead = can(userRole, "read", "AuditLog");

  const searchParams = useSearchParams();
  const initialEntity = searchParams.get("entity") || "ALL";

  // State Management
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<UserSelectorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters State
  const [entityFilter, setEntityFilter] = useState(initialEntity);
  const [userFilter, setUserFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // UI Detail Toggle State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Fetch users selector list
  useEffect(() => {
    if (!canRead) return;

    const fetchUsersList = async () => {
      try {
        const response = await fetch("/api/users/selector");
        const resData = await response.json();
        if (resData.success) {
          setUsers(resData.data);
        }
      } catch (error) {
        console.error("Failed to load user list for filter:", error);
      } finally {
        setIsUsersLoading(false);
      }
    };

    fetchUsersList();
  }, [canRead]);

  // Fetch audit logs when filters/pages change
  const fetchLogs = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (entityFilter !== "ALL") queryParams.append("entity", entityFilter);
      if (userFilter !== "ALL") queryParams.append("userId", userFilter);
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);

      const response = await fetch(`/api/audit-logs?${queryParams.toString()}`);
      const resData = await response.json();

      if (resData.success) {
        setLogs(resData.data.logs);
        setTotalPages(resData.data.totalPages || 1);
      } else {
        setErrorMessage(resData.message || "Failed to load audit logs.");
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      setErrorMessage("An error occurred while loading audit logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      fetchLogs();
    }
  }, [currentPage, entityFilter, userFilter, startDate, endDate, canRead]);

  // Guard: Unauthorized role access
  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4 max-w-md mx-auto">
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Access Denied</h2>
        <p className="text-sm text-slate-400">
          You do not have authorization to view the Audit Logging database logs.
        </p>
      </div>
    );
  }

  // Handle filter resets
  const handleResetFilters = () => {
    setEntityFilter("ALL");
    setUserFilter("ALL");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Safe JSON pretty-printing
  const renderJSON = (jsonStr: string | null) => {
    if (!jsonStr) return <span className="text-slate-600 font-mono italic">None</span>;
    try {
      const obj = JSON.parse(jsonStr);
      return (
        <pre className="text-[10px] text-amber-500/95 bg-[#07080C] p-3 rounded-lg overflow-x-auto border border-[#1E293B] font-mono leading-relaxed max-w-full">
          {JSON.stringify(obj, null, 2)}
        </pre>
      );
    } catch {
      return <span className="font-mono text-slate-400 break-all">{jsonStr}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#1E293B] pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
          <History className="w-8 h-8 text-amber-500" />
          Audit Logs
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Read-only system trail ledger of user and background data modifications.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter panel */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 p-5 rounded-xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-slate-200 font-mono text-[11px] uppercase tracking-wider font-bold">
          <Filter className="w-4 h-4 text-amber-500" /> Filter Selection
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Entity Type Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-mono uppercase font-bold flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-500" /> Entity Type
            </label>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="ALL">All Entities</option>
              <option value="Product">Products</option>
              <option value="SalesOrder">Sales Orders</option>
              <option value="PurchaseOrder">Purchase Orders</option>
              <option value="ManufacturingOrder">Manufacturing Orders</option>
              <option value="BillOfMaterials">Bill of Materials</option>
              <option value="User">Users</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-mono uppercase font-bold flex items-center gap-1">
              <User className="w-3 h-3 text-slate-500" /> User
            </label>
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setCurrentPage(1);
              }}
              disabled={isUsersLoading}
              className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-40"
            >
              <option value="ALL">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-mono uppercase font-bold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-mono uppercase font-bold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-[#07080C] hover:bg-slate-900 border border-[#1E293B] hover:border-[#1E293B]/80 text-slate-300 rounded-lg text-[10px] font-mono font-bold transition-all uppercase tracking-wider"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="text-center py-24 text-slate-500 text-xs font-mono">
            Reading security logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-24 text-slate-500 text-xs">
            No audit log records found for the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-400 font-mono">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Entity Reference ID</th>
                  <th className="p-4">Operator</th>
                  <th className="p-4 text-right">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40 text-slate-300">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-[#07080C]/30 transition-colors">
                        <td className="p-4 font-mono text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wide">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-200">{log.entity}</td>
                        <td className="p-4 font-mono text-slate-400">{log.entityId}</td>
                        <td className="p-4">
                          {log.user ? (
                            <div>
                              <p className="font-semibold text-slate-300">{log.user.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{log.user.email}</p>
                            </div>
                          ) : (
                            <span className="text-slate-600 font-mono italic">System API</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => toggleExpandLog(log.id)}
                            className="p-1.5 hover:bg-slate-900 border border-transparent hover:border-[#1E293B] text-slate-400 hover:text-amber-500 rounded-lg transition-all inline-flex items-center gap-1 font-mono text-[10px] font-bold"
                          >
                            {isExpanded ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" /> Collapse
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" /> View Diff
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON details pane */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-4 bg-[#07080C]/40 border-t border-b border-[#1E293B]/40">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                                  State Before Mutation
                                </span>
                                {renderJSON(log.oldValue)}
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                                  State After Mutation
                                </span>
                                {renderJSON(log.newValue)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-[#0E111A] border border-[#1E293B]/60 p-4 rounded-xl text-xs text-slate-400 font-mono shadow-md">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-[#07080C] hover:bg-slate-900 border border-[#1E293B] rounded-lg disabled:opacity-40 transition-colors disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-[#07080C] hover:bg-slate-900 border border-[#1E293B] rounded-lg disabled:opacity-40 transition-colors disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<div className="text-center py-24 text-slate-500 font-mono text-xs">Loading audit logging dashboard...</div>}>
      <AuditLogsContent />
    </Suspense>
  );
}
