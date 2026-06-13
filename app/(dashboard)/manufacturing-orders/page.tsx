"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import { Role, MOStatus } from "@prisma/client";
import {
  Factory,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Play,
  CheckCircle,
  Archive,
  Ban,
  Link2,
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  procurementType: string;
}

interface MoComponentItem {
  id?: string;
  productId: string;
  quantity: number;
  product?: {
    name: string;
    sku: string;
  };
}

interface MoWorkOrderItem {
  id?: string;
  operation: string;
  workCenter: string;
  expectedDuration: number;
}

interface MoItem {
  id: string;
  moNumber: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  status: MOStatus;
  createdAt: string;
  hasBom: boolean;
  bomId: string | null;
  bomReference: string | null;
  components: MoComponentItem[];
  workOrders: MoWorkOrderItem[];
  salesOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
  } | null;
}

export default function ManufacturingOrdersPage() {
  const { data: session } = useSession();
  const userRole = (session?.user?.role as Role) || "VIEWER";

  // Check UI permissions
  const canWrite = can(userRole, "write", "ManufacturingOrder");

  // State Management
  const [mos, setMos] = useState<MoItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search/Filters/Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"moNumber" | "product" | "quantity" | "status" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingMoId, setEditingMoId] = useState<string | null>(null);
  const [targetProductId, setTargetProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedBomId, setSelectedBomId] = useState("");
  const [moComponents, setMoComponents] = useState<MoComponentItem[]>([]);
  const [moWorkOrders, setMoWorkOrders] = useState<MoWorkOrderItem[]>([]);
  const [drawerTab, setDrawerTab] = useState<"components" | "workOrders">("components");

  // Initial Data Fetching
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [mosRes, productsRes, bomsRes] = await Promise.all([
        fetch("/api/manufacturing-orders"),
        fetch("/api/products"),
        fetch("/api/bom"),
      ]);

      const mosData = await mosRes.json();
      const productsData = await productsRes.json();
      const bomsData = await bomsRes.json();

      if (mosData.success) setMos(mosData.data);
      if (productsData.success) setProducts(productsData.data);
      if (bomsData.success) setBoms(bomsData.data);
    } catch (error) {
      console.error("Failed to load page data:", error);
      setErrorMessage("Failed to load Manufacturing Orders. Please reload.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const editingMo = editingMoId ? mos.find((m) => m.id === editingMoId) : null;
  const isDraft = !editingMo || editingMo.status === "DRAFT";
  const isEditable = isDraft && canWrite;

  // Form actions
  const openNewDrawer = () => {
    setEditingMoId(null);
    setTargetProductId("");
    setQuantity(1);
    setSelectedBomId("");
    setMoComponents([]);
    setMoWorkOrders([]);
    setDrawerTab("components");
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (mo: MoItem) => {
    setEditingMoId(mo.id);
    setTargetProductId(mo.productId);
    setQuantity(mo.quantity);
    setSelectedBomId(mo.bomId || "");
    setMoComponents(mo.components || []);
    setMoWorkOrders(mo.workOrders || []);
    setDrawerTab("components");
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDrawerOpen(true);
  };

  // Handlers for dynamic state changes
  const handleProductChange = (productId: string) => {
    setTargetProductId(productId);
    if (!isEditable) return;

    // Find default BoM for this product
    const defaultBom = boms.find((b) => b.productId === productId);
    if (defaultBom) {
      setSelectedBomId(defaultBom.id);
      const scaled = defaultBom.components.map((comp: any) => ({
        productId: comp.productId,
        quantity: Math.max(1, Math.round(comp.quantity * (quantity / (defaultBom.quantity || 1)))),
        product: comp.product,
      }));
      setMoComponents(scaled);
      setMoWorkOrders(defaultBom.workOrders || []);
    } else {
      setSelectedBomId("");
      setMoComponents([]);
      setMoWorkOrders([]);
    }
  };

  const handleQuantityChange = (newQty: number) => {
    setQuantity(newQty);
    if (!isEditable) return;

    if (selectedBomId) {
      const bom = boms.find((b) => b.id === selectedBomId);
      if (bom) {
        const scaled = bom.components.map((comp: any) => ({
          productId: comp.productId,
          quantity: Math.max(1, Math.round(comp.quantity * (newQty / (bom.quantity || 1)))),
          product: comp.product,
        }));
        setMoComponents(scaled);
      }
    }
  };

  const handleBomChange = (bomId: string) => {
    setSelectedBomId(bomId);
    if (!isEditable) return;

    if (bomId) {
      const bom = boms.find((b) => b.id === bomId);
      if (bom) {
        const scaled = bom.components.map((comp: any) => ({
          productId: comp.productId,
          quantity: Math.max(1, Math.round(comp.quantity * (quantity / (bom.quantity || 1)))),
          product: comp.product,
        }));
        setMoComponents(scaled);
        setMoWorkOrders(bom.workOrders || []);
      }
    } else {
      setMoComponents([]);
      setMoWorkOrders([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Form Validations
    if (!targetProductId) {
      setErrorMessage("Please select a target product.");
      return;
    }

    if (quantity <= 0) {
      setErrorMessage("Quantity must be greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingMoId ? `/api/manufacturing-orders/${editingMoId}` : "/api/manufacturing-orders";
      const method = editingMoId ? "PATCH" : "POST";

      const payload: any = {
        productId: targetProductId,
        quantity,
      };

      if (editingMoId) {
        payload.bomId = selectedBomId || null;
      } else {
        payload.bomId = selectedBomId || undefined;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (resData.success) {
        setSuccessMessage(
          editingMoId ? "Manufacturing Order updated successfully!" : "Manufacturing Order created successfully!"
        );
        setIsDrawerOpen(false);
        fetchData();
      } else {
        setErrorMessage(resData.message || "Failed to save Manufacturing Order.");
      }
    } catch (error) {
      console.error("Save error:", error);
      setErrorMessage("An error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Status transitions
  const handleTransition = async (moId: string, targetStatus: MOStatus) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setActionLoadingId(moId);

    try {
      const response = await fetch(`/api/manufacturing-orders/${moId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      const resData = await response.json();

      if (resData.success) {
        setSuccessMessage(`Order status successfully transitioned to ${targetStatus}.`);
        fetchData();
      } else {
        setErrorMessage(resData.message || "Failed to update order status.");
      }
    } catch (error) {
      console.error("Transition error:", error);
      setErrorMessage("An error occurred during transition. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Sort & Search Processing
  const handleSort = (field: "moNumber" | "product" | "quantity" | "status" | "date") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredMos = mos.filter((mo) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      mo.moNumber.toLowerCase().includes(query) ||
      mo.productName.toLowerCase().includes(query) ||
      mo.productSku.toLowerCase().includes(query) ||
      (mo.salesOrder && mo.salesOrder.orderNumber.toLowerCase().includes(query));

    const matchesStatus = statusFilter === "ALL" || mo.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedMos = [...filteredMos].sort((a, b) => {
    const factor = sortDirection === "asc" ? 1 : -1;
    if (sortField === "moNumber") {
      return a.moNumber.localeCompare(b.moNumber) * factor;
    }
    if (sortField === "product") {
      return a.productName.localeCompare(b.productName) * factor;
    }
    if (sortField === "quantity") {
      return (a.quantity - b.quantity) * factor;
    }
    if (sortField === "status") {
      return a.status.localeCompare(b.status) * factor;
    }
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
  });

  // Pagination Processing
  const totalPages = Math.ceil(sortedMos.length / itemsPerPage);
  const paginatedMos = sortedMos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Products filter (MAKE type only)
  const makeProducts = products.filter((p) => p.procurementType === "MAKE");

  // Get status color styling
  const getStatusBadge = (status: MOStatus) => {
    switch (status) {
      case MOStatus.DRAFT:
        return (
          <span className="inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-500/25 rounded">
            Draft
          </span>
        );
      case MOStatus.STARTED:
        return (
          <span className="inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded">
            In Progress
          </span>
        );
      case MOStatus.COMPLETED:
        return (
          <span className="inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded">
            Done
          </span>
        );
      case MOStatus.CLOSED:
        return (
          <span className="inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/25 rounded">
            Closed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <Factory className="w-8 h-8 text-amber-500" />
            Manufacturing Orders
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Initiate, track, and complete production operations for MAKE products.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openNewDrawer}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/10 text-xs"
            id="btn-create-mo"
          >
            <Plus className="w-4 h-4" />
            Create MO
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold whitespace-pre-line flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-[#0E111A] border border-[#1E293B]/60 p-4 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by order #, product, or SO #..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#07080C] border border-[#1E293B] hover:border-[#1E293B]/80 text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600 font-medium transition-all"
          />
        </div>

        <div className="flex gap-2">
          {["ALL", "DRAFT", "STARTED", "COMPLETED", "CLOSED"].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 rounded-lg font-mono text-[10px] font-bold border transition-colors ${
                statusFilter === status
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "bg-[#07080C] border-[#1E293B] hover:border-[#1E293B]/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {status === "ALL" ? "All" : status === "STARTED" ? "In Progress" : status === "COMPLETED" ? "Done" : status === "CLOSED" ? "Closed" : "Draft"}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid / Table */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono">
            Loading production orders...
          </div>
        ) : paginatedMos.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs">
            No manufacturing orders found. Use the creation drawer to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-400 font-mono">
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("moNumber")}
                  >
                    <div className="flex items-center gap-1.5">
                      Order Number
                      {sortField === "moNumber" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("product")}
                  >
                    <div className="flex items-center gap-1.5">
                      Product Name
                      {sortField === "product" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors text-right"
                    onClick={() => handleSort("quantity")}
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      Quantity
                      {sortField === "quantity" &&
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
                      Status
                      {sortField === "status" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th className="p-4">Linked Recipe (BoM)</th>
                  <th className="p-4">Workflow Type (MTO/MTS)</th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1.5">
                      Date Created
                      {sortField === "date" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  {canWrite && <th className="p-4 text-right">Workflow Transition Control</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40 text-slate-300">
                {paginatedMos.map((mo) => (
                  <tr 
                    key={mo.id} 
                    className="hover:bg-[#07080C]/40 transition-colors cursor-pointer"
                    onClick={() => openEditDrawer(mo)}
                  >
                    <td className="p-4 font-mono font-semibold text-slate-100">{mo.moNumber}</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-200">{mo.productName}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{mo.productSku}</div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-200">{mo.quantity}</td>
                    <td className="p-4">{getStatusBadge(mo.status)}</td>
                    <td className="p-4">
                      {mo.bomReference ? (
                        <span className="text-emerald-500 text-[10px] font-semibold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 flex items-center w-fit gap-1 font-mono">
                          <CheckCircle className="w-3 h-3" /> {mo.bomReference}
                        </span>
                      ) : (
                        <span className="text-red-400 text-[10px] font-semibold bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10 flex items-center w-fit gap-1">
                          <AlertTriangle className="w-3 h-3" /> No BOM
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {mo.salesOrder ? (
                        <div className="space-y-1">
                          <span className="text-blue-400 text-[9px] font-bold font-mono bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10 uppercase">
                            MTO (Make to Order)
                          </span>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                            <Link2 className="w-3.5 h-3.5 text-blue-500" />
                            {mo.salesOrder.orderNumber} ({mo.salesOrder.customerName})
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[9px] font-bold font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-[#1E293B] uppercase">
                          MTS (Stock Fill)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 font-mono">
                      {new Date(mo.createdAt).toLocaleDateString()}
                    </td>
                    {canWrite && (
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {actionLoadingId === mo.id ? (
                          <span className="text-slate-500 font-mono text-[10px]">Processing...</span>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            {/* Draft Options: Start or Cancel */}
                            {mo.status === MOStatus.DRAFT && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransition(mo.id, MOStatus.STARTED);
                                  }}
                                  className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-500 px-2 py-1 rounded text-[10px] font-bold font-mono"
                                  title="Start production"
                                >
                                  <Play className="w-3 h-3" /> Start
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransition(mo.id, MOStatus.CLOSED);
                                  }}
                                  className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 px-2 py-1 rounded text-[10px] font-bold font-mono"
                                  title="Cancel order"
                                >
                                  <Ban className="w-3 h-3" /> Cancel
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDrawer(mo);
                                  }}
                                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-[#1E293B] hover:border-[#1E293B]/80 text-slate-300 rounded text-[10px] font-bold font-mono"
                                >
                                  Edit MO
                                </button>
                              </>
                            )}

                            {/* Started Options: Complete or Cancel */}
                            {mo.status === MOStatus.STARTED && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransition(mo.id, MOStatus.COMPLETED);
                                  }}
                                  className="flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold font-mono"
                                  title="Complete and consume materials"
                                >
                                  <CheckCircle className="w-3 h-3" /> Complete
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransition(mo.id, MOStatus.CLOSED);
                                  }}
                                  className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 px-2 py-1 rounded text-[10px] font-bold font-mono"
                                  title="Cancel order"
                                >
                                  <Ban className="w-3 h-3" /> Cancel
                                </button>
                              </>
                            )}

                            {/* Completed Options: Close */}
                            {mo.status === MOStatus.COMPLETED && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTransition(mo.id, MOStatus.CLOSED);
                                }}
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-[#1E293B] text-slate-300 px-2 py-1 rounded text-[10px] font-bold font-mono"
                                title="Close order logs"
                              >
                                <Archive className="w-3 h-3" /> Close Log
                              </button>
                            )}

                            {mo.status === MOStatus.CLOSED && (
                              <span className="text-slate-600 font-mono text-[9px]">Archived</span>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-[#0E111A] border border-[#1E293B]/60 p-4 rounded-xl text-xs text-slate-400 font-mono">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-[#07080C] hover:bg-slate-900 border border-[#1E293B] rounded-lg disabled:opacity-40 transition-colors disabled:pointer-events-none"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-[#07080C] hover:bg-slate-900 border border-[#1E293B] rounded-lg disabled:opacity-40 transition-colors disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Right Drawer for Creating MOs */}
      <div
        className={`fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsDrawerOpen(false)}
      >
        <div
          className={`w-full max-w-xl h-full bg-[#0E111A] border-l border-[#1E293B] shadow-2xl flex flex-col justify-between transition-transform duration-300 ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#1E293B] flex justify-between items-center bg-[#07080C]/40">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-bold block mb-1">
                {editingMoId ? (editingMo?.moNumber || "Order Template") : "New Order Template"}
              </span>
              <h3 className="text-lg font-bold text-slate-100">
                {editingMoId ? (isEditable ? "Edit Manufacturing Order" : "Manufacturing Order Details") : "Create Manufacturing Order"}
              </h3>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-[#1E293B] rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Target MAKE product select */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Target Product (MAKE)
              </label>
              <select
                value={targetProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                disabled={!!editingMoId || !isEditable}
                className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">-- Choose target MAKE product --</option>
                {makeProducts.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} ({prod.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Target Quantity input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Output Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  disabled={!isEditable}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* BoM dropdown selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Bill of Materials (BoM)
                </label>
                <select
                  value={selectedBomId}
                  onChange={(e) => handleBomChange(e.target.value)}
                  disabled={!isEditable || !targetProductId}
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">-- Choose BOM --</option>
                  {boms
                    .filter((b) => b.productId === targetProductId)
                    .map((bom) => (
                      <option key={bom.id} value={bom.id}>
                        {bom.reference || `BOM for ${bom.product.name}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Components & Work Orders Tabs Switching */}
            {targetProductId && (
              <div className="pt-4 border-t border-[#1E293B]/40">
                <div className="flex border-b border-[#1E293B]/60 p-1 bg-[#07080C]/80 rounded-xl mb-4 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setDrawerTab("components")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                      drawerTab === "components"
                        ? "bg-slate-800 text-slate-100 shadow border border-slate-700/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Components
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab("workOrders")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                      drawerTab === "workOrders"
                        ? "bg-slate-800 text-slate-100 shadow border border-slate-700/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Work Orders
                  </button>
                </div>

                {/* Tab 1: Components Grid */}
                {drawerTab === "components" && (
                  <div className="space-y-3 pt-2">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                      Required Components
                    </label>
                    <div className="space-y-2">
                      {moComponents.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic py-4 text-center bg-[#07080C]/20 border border-[#1E293B]/40 rounded-lg">
                          No components required. Please select a BOM.
                        </p>
                      ) : (
                        moComponents.map((comp, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-[#07080C]/20 p-3 rounded-lg border border-[#1E293B]/40 text-xs text-slate-300 font-mono"
                          >
                            <div>
                              <div className="font-semibold text-slate-200">
                                {comp.product?.name || "Unknown Product"}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                SKU: {comp.product?.sku || "N/A"}
                              </div>
                            </div>
                            <div className="font-bold text-amber-500">
                              {comp.quantity} Units
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 2: Work Orders Grid */}
                {drawerTab === "workOrders" && (
                  <div className="space-y-3 pt-2">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                      Operations Sequence
                    </label>
                    <div className="space-y-2">
                      {moWorkOrders.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic py-4 text-center bg-[#07080C]/20 border border-[#1E293B]/40 rounded-lg">
                          No operations configured. Please select a BOM.
                        </p>
                      ) : (
                        moWorkOrders.map((wo, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-[#07080C]/20 p-3 rounded-lg border border-[#1E293B]/40 text-xs text-slate-300 font-mono"
                          >
                            <div>
                              <div className="font-semibold text-slate-200">
                                {wo.operation}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Center: {wo.workCenter}
                              </div>
                            </div>
                            <div className="font-semibold text-amber-500">
                              {wo.expectedDuration} mins
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Drawer Footer */}
          <div className="p-6 border-t border-[#1E293B] bg-[#0E111A] flex gap-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300 font-mono"
            >
              {isEditable ? "Cancel" : "Close"}
            </button>
            {isEditable && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold transition-all active:scale-98 text-xs font-mono"
              >
                {isSaving ? "Saving..." : "Save Order"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
