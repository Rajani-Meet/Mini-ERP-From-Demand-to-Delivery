"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import { Role } from "@prisma/client";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

interface ProductSelectorItem {
  id: string;
  name: string;
  sku: string;
  procurementType: string;
}

interface ComponentItem {
  productId: string;
  quantity: number;
  product?: {
    name: string;
    sku: string;
  };
}

interface BomItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    name: string;
    sku: string;
  };
  components: ComponentItem[];
  createdAt: string;
}

export default function BillOfMaterialsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user?.role as Role) || "VIEWER";

  // Check UI permissions
  const canWrite = can(userRole, "write", "BillOfMaterials");

  // State Management
  const [boms, setBoms] = useState<BomItem[]>([]);
  const [products, setProducts] = useState<ProductSelectorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search/Sort/Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"product" | "components" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [parentProductId, setParentProductId] = useState("");
  const [bomQuantity, setBomQuantity] = useState(1);
  const [components, setComponents] = useState<{ productId: string; quantity: number }[]>([
    { productId: "", quantity: 1 },
  ]);

  // Initial Data Fetching
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bomsRes, productsRes] = await Promise.all([
        fetch("/api/bom"),
        fetch("/api/products"),
      ]);

      const bomsData = await bomsRes.json();
      const productsData = await productsRes.json();

      if (bomsData.success) setBoms(bomsData.data);
      if (productsData.success) setProducts(productsData.data);
    } catch (error) {
      console.error("Failed to load page data:", error);
      setErrorMessage("Failed to load Bills of Materials. Please reload.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form actions
  const openNewDrawer = () => {
    setEditingBomId(null);
    setParentProductId("");
    setBomQuantity(1);
    setComponents([{ productId: "", quantity: 1 }]);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (bom: BomItem) => {
    setEditingBomId(bom.id);
    setParentProductId(bom.productId);
    setBomQuantity(bom.quantity);
    setComponents(
      bom.components.map((comp) => ({
        productId: comp.productId,
        quantity: comp.quantity,
      }))
    );
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDrawerOpen(true);
  };

  const handleAddComponentRow = () => {
    setComponents([...components, { productId: "", quantity: 1 }]);
  };

  const handleRemoveComponentRow = (index: number) => {
    const updated = [...components];
    updated.splice(index, 1);
    setComponents(updated);
  };

  const handleComponentChange = (index: number, field: "productId" | "quantity", value: string | number) => {
    const updated = [...components];
    if (field === "productId") {
      updated[index].productId = value as string;
    } else {
      updated[index].quantity = Math.max(1, value as number);
    }
    setComponents(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Frontend Validations
    if (!parentProductId) {
      setErrorMessage("Please select a parent product.");
      return;
    }

    if (components.length === 0) {
      setErrorMessage("Please add at least one component.");
      return;
    }

    const hasEmptyComponent = components.some((c) => !c.productId || c.quantity <= 0);
    if (hasEmptyComponent) {
      setErrorMessage("All components must have a selected product and a quantity greater than zero.");
      return;
    }

    // Check for duplicate components
    const componentIds = components.map((c) => c.productId);
    if (new Set(componentIds).size !== componentIds.length) {
      setErrorMessage("Duplicate components are not allowed in the same BoM.");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingBomId ? `/api/bom/${editingBomId}` : "/api/bom";
      const method = editingBomId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: parentProductId,
          quantity: bomQuantity,
          components,
        }),
      });

      const resData = await response.json();

      if (resData.success) {
        setSuccessMessage(
          editingBomId
            ? "Bill of Materials updated successfully!"
            : "Bill of Materials created successfully!"
        );
        setIsDrawerOpen(false);
        fetchData();
      } else {
        setErrorMessage(resData.message || "Failed to save Bill of Materials.");
      }
    } catch (error) {
      console.error("Save error:", error);
      setErrorMessage("An error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Bill of Materials? This action cannot be undone.")) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/bom/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Bill of Materials deleted successfully.");
        fetchData();
      } else {
        setErrorMessage(data.message || "Failed to delete Bill of Materials.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      setErrorMessage("Failed to delete. Try again.");
    }
  };

  // Sort & Search Processing
  const handleSort = (field: "product" | "components" | "date") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredBoms = boms.filter((bom) => {
    const query = searchQuery.toLowerCase();
    return (
      bom.product.name.toLowerCase().includes(query) ||
      bom.product.sku.toLowerCase().includes(query)
    );
  });

  const sortedBoms = [...filteredBoms].sort((a, b) => {
    const factor = sortDirection === "asc" ? 1 : -1;
    if (sortField === "product") {
      return a.product.name.localeCompare(b.product.name) * factor;
    }
    if (sortField === "components") {
      return (a.components.length - b.components.length) * factor;
    }
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
  });

  // Pagination Processing
  const totalPages = Math.ceil(sortedBoms.length / itemsPerPage);
  const paginatedBoms = sortedBoms.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filter candidates for parent product (MAKE type only)
  const makeProducts = products.filter(
    (p) =>
      p.procurementType === "MAKE" &&
      // Exclude products that already have a BoM, unless we are editing that exact product's BoM
      (!boms.some((b) => b.productId === p.id) || (editingBomId && parentProductId === p.id))
  );

  // Filter candidates for components
  const componentCandidates = products;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-amber-500" />
            Bill of Materials (BoM)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Specify manufacturing recipes and required component quantities.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openNewDrawer}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/10 text-xs"
            id="btn-create-bom"
          >
            <Plus className="w-4 h-4" />
            Create BoM
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
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center gap-3 bg-[#0E111A] border border-[#1E293B]/60 p-4 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#07080C] border border-[#1E293B] hover:border-[#1E293B]/80 text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-slate-600 font-medium transition-all"
          />
        </div>
      </div>

      {/* Grid / Table */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="text-center py-20 text-slate-500 text-xs">
            Loading recipe specifications...
          </div>
        ) : paginatedBoms.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs">
            No Bills of Materials found. Get started by clicking &quot;Create BoM&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-400 font-mono">
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("product")}
                  >
                    <div className="flex items-center gap-1.5">
                      Parent Product
                      {sortField === "product" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th className="p-4">SKU</th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort("components")}
                  >
                    <div className="flex items-center gap-1.5">
                      Components Required
                      {sortField === "components" &&
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
                      Created At
                      {sortField === "date" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  {canWrite && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40 text-slate-300">
                {paginatedBoms.map((bom) => (
                  <tr key={bom.id} className="hover:bg-[#07080C]/40 transition-colors">
                    <td className="p-4 font-semibold text-slate-100">{bom.product.name}</td>
                    <td className="p-4 font-mono text-slate-400">{bom.product.sku}</td>
                    <td className="p-4">
                      <span className="font-mono text-amber-500 font-bold mr-1.5">
                        {bom.components.length}
                      </span>
                      items
                    </td>
                    <td className="p-4 text-slate-500">
                      {new Date(bom.createdAt).toLocaleDateString()}
                    </td>
                    {canWrite && (
                      <td className="p-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => openEditDrawer(bom)}
                          className="p-2 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-lg text-slate-400 hover:text-amber-500 transition-all"
                          title="Edit recipe"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(bom.id)}
                          className="p-2 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                          title="Delete recipe"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
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

      {/* Right Side Creation/Edition Drawer */}
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
          <div className="p-6 border-b border-[#1E293B] flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-100" id="drawer-title">
                {editingBomId ? "Modify Bill of Materials" : "Define Bill of Materials"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Specify component recipe ratios.
              </p>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-[#1E293B] rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Parent Product selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Parent Product (Procurement: MAKE)
              </label>
              <select
                value={parentProductId}
                onChange={(e) => setParentProductId(e.target.value)}
                disabled={!!editingBomId}
                className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">-- Select Parent Product --</option>
                {makeProducts.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} ({prod.sku})
                  </option>
                ))}
              </select>
              {makeProducts.length === 0 && !editingBomId && (
                <p className="text-[10px] text-amber-500">
                  * Note: No available &quot;MAKE&quot; products without an existing BoM specification.
                </p>
              )}
            </div>

            {/* Parent output quantity */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Output Batch Quantity
              </label>
              <input
                type="number"
                min="1"
                value={bomQuantity}
                onChange={(e) => setBomQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Components dynamic fields */}
            <div className="space-y-3 pt-3 border-t border-[#1E293B]/50">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Components and Ratios
                </label>
                <button
                  type="button"
                  onClick={handleAddComponentRow}
                  className="flex items-center gap-1 text-[10px] font-mono text-amber-500 hover:text-amber-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Component
                </button>
              </div>

              <div className="space-y-3">
                {components.map((comp, idx) => (
                  <div key={idx} className="flex gap-2.5 items-end">
                    <div className="flex-1 space-y-1">
                      <select
                        value={comp.productId}
                        onChange={(e) => handleComponentChange(idx, "productId", e.target.value)}
                        className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        <option value="">-- Choose Component --</option>
                        {componentCandidates.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} ({prod.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24 space-y-1">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={comp.quantity}
                        onChange={(e) =>
                          handleComponentChange(idx, "quantity", parseInt(e.target.value) || 0)
                        }
                        className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveComponentRow(idx)}
                      disabled={components.length === 1}
                      className="p-2.5 border border-[#1E293B] hover:border-red-500/30 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </form>

          {/* Sticky Footer */}
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
              {isSaving ? "Saving..." : "Save Recipe"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
