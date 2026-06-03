import React, { useState } from "react";
import { 
  Search, 
  Trash2, 
  UserPlus, 
  Edit3, 
  X, 
  Check, 
  Phone,
  Mail,
  Calendar,
  Sparkles,
  AlertCircle,
  Clock,
  Briefcase,
  Layers,
  MoreVertical
} from "lucide-react";
import { UserRecord, UserRole, UserStatus, SubscriptionRecord } from "../types";

interface UserTableProps {
  users: UserRecord[];
  onAddUser: (user: {
    displayName: string;
    email: string;
    matric: string;
    role?: UserRole;
    status?: UserStatus;
    phoneNumber?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateUser: (id: string, updates: Partial<UserRecord>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  isSyncing: boolean;
  subscriptions: Record<string, SubscriptionRecord>;
  onGrantSubscription: (matricNumber: string) => Promise<void>;
}

export default function UserTable({
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  isSyncing,
  subscriptions,
  onGrantSubscription
}: UserTableProps) {
  const [editIsCourseRep, setEditIsCourseRep] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Insert form fields (as requested, only Email, Matric and Name are needed, other properties use cloud defaults)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [matric, setMatric] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form fields (allows editing all user parameters)
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("user");
  const [editStatus, setEditStatus] = useState<UserStatus>("active");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editMatric, setEditMatric] = useState("");

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.matric && user.matric.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.notes && user.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleOpenAdd = () => {
    setName("");
    setEmail("");
    setMatric("");
    setFormError("");
    setIsAddOpen(true);
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditName(user.displayName);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPhone(user.phoneNumber || "");
    setEditNotes(user.notes || "");
    setEditMatric(user.matric || "");
    setEditIsCourseRep(!!user.isCourseRep || user.role === "course_rep");
    setFormError("");
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim() || !email.trim() || !matric.trim()) {
      setFormError("Full Name, Email, and Matric Number are required properties.");
      return;
    }
    if (!email.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddUser({
        displayName: name.trim(),
        email: email.trim(),
        matric: matric.trim(),
        role: "user",
        status: "active"
      });
      setIsAddOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to create cloud user record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError("");
    
    if (!editName.trim()) {
      setFormError("Display name cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateUser(editingUser.id, {
        displayName: editName.trim(),
        role: editIsCourseRep ? "course_rep" : editRole,
        status: editStatus,
        phoneNumber: editPhone.trim() || undefined,
        notes: editNotes.trim() || undefined,
        matric: editMatric.trim() || undefined,
        isCourseRep: editIsCourseRep
      });
      setEditingUser(null);
    } catch (err: any) {
      setFormError(err.message || "Failed to update cloud user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setFormError("");
    setDeletingUser({ id, name });
  };

  return (
    <div className="space-y-4">
      {/* Search & Action bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#111322]/80 backdrop-blur-md rounded-2xl p-4 border border-white/[0.06]">
        
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search CRM entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181a2e] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500/80 transition-colors"
          />
        </div>

        {/* Filter items */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#181a2e] border border-white/[0.08] text-xs rounded-xl px-3 py-2 text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="all">Roles: All</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="user">User</option>
            <option value="developer">Developer</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#181a2e] border border-white/[0.08] text-xs rounded-xl px-3 py-2 text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="all">Statuses: All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md active:scale-95"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Grid or Table */}
      <div className="bg-[#111322]/80 backdrop-blur-md rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-sans space-y-2">
              <Layers className="h-8 w-8 text-indigo-400/80 mx-auto animate-pulse" />
              <p className="text-sm font-semibold">No active cloud users found</p>
              <p className="text-xs text-slate-500">Try adjusting your filters or click "Add User" to begin.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-slate-400 font-mono text-[10px] uppercase tracking-wider bg-white/[0.01]">
                  <th className="py-4 px-5">User Details</th>
                  <th className="py-4 px-5">Role</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-4 hidden md:table-cell">Notes & Details</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredUsers.map((user) => {
                  const userMatric = user.matric || user.id;
                  const sub = subscriptions ? subscriptions[userMatric] : null;
                  let subStatus: "none" | "active" | "expired" = "none";
                  let expiresFormatted = "";
                  let expiresLeftMs = 0;
                  if (sub) {
                    expiresLeftMs = new Date(sub.expiresAt).getTime() - Date.now();
                    if (expiresLeftMs > 0) {
                      subStatus = "active";
                      const dateObj = new Date(sub.expiresAt);
                      expiresFormatted = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                      subStatus = "expired";
                      const dateObj = new Date(sub.expiresAt);
                      expiresFormatted = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                  }

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] text-xs transition-colors">
                      {/* User profile details */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150"}
                            alt={user.displayName}
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 rounded-full object-cover border border-white/[0.08]"
                          />
                          <div className="space-y-0.5">
                            <div className="font-bold text-white tracking-wide text-sm">{user.displayName}</div>
                            <div className="text-slate-400 font-mono text-[10px] flex items-center gap-1.5">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span>{user.email}</span>
                            </div>

                            {user.matric && (
                              <div className="text-cyan-400 font-mono text-[9px] flex items-center gap-1.5 mt-1 leading-none">
                                <span className="bg-cyan-500/10 border border-cyan-400/20 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                                  Matric: {user.matric}
                                </span>
                              </div>
                            )}

                            {user.phoneNumber && (
                              <div className="text-slate-500 font-mono text-[9px] flex items-center gap-1.5">
                                <Phone className="h-2.5 w-2.5 shrink-0" />
                                <span>{user.phoneNumber}</span>
                              </div>
                            )}

                            {/* Badges layout */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                              {user.isCourseRep && (
                                <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-450/30 px-1.5 py-0.5 rounded text-[9.5px] font-mono text-amber-400 font-bold tracking-wide uppercase select-none">
                                  ✨ Course Rep
                                </span>
                              )}

                              {subStatus === "active" ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-555/10 border border-emerald-500/30 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[9.5px] font-bold tracking-wide uppercase select-none">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  Active (Exp: {expiresFormatted})
                                </span>
                              ) : subStatus === "expired" ? (
                                <span className="inline-flex items-center gap-1 bg-rose-555/10 border border-rose-500/30 px-1.5 py-0.5 rounded text-rose-400 font-mono text-[9.5px] font-bold tracking-wide uppercase select-none animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping duration-1000" />
                                  Expired ({expiresFormatted})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-500/10 border border-slate-400/20 px-1.5 py-0.5 rounded text-slate-400 font-mono text-[9.5px] font-semibold tracking-wide uppercase select-none">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                  No Access
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role capsule */}
                      <td className="py-4 px-5 align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider 
                          ${user.role === "admin" ? "bg-red-500/10 text-red-400 border border-red-500/20" : 
                            user.role === "moderator" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : 
                            user.role === "developer" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : 
                            user.role === "course_rep" ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" :
                            "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"}`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Status capsule */}
                      <td className="py-4 px-5 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 animate-ping
                            ${user.status === "active" ? "bg-emerald-400" : 
                              user.status === "pending" ? "bg-yellow-400" : "bg-red-400"}`} 
                          />
                          <span className={`font-semibold capitalize text-[11px]
                            ${user.status === "active" ? "text-emerald-400" : 
                              user.status === "pending" ? "text-yellow-400" : "text-rose-400"}`}
                          >
                            {user.status}
                          </span>
                        </div>
                      </td>

                      {/* Notes (hidden on small screens) */}
                      <td className="py-4 px-4 align-middle hidden md:table-cell">
                        <div className="space-y-1.5">
                          {user.notes && (
                            <div className="max-w-xs text-slate-400 line-clamp-1 text-[11px] italic leading-relaxed">
                              {user.notes}
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-slate-400 space-y-1 bg-white/[0.01] border border-white/[0.04] rounded-xl p-2 max-w-xs">
                            {user.matric && (
                              <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-1">
                                <span className="text-slate-500 text-[9px] font-semibold uppercase">Matric No:</span>
                                <span className="text-cyan-400 font-bold font-mono">{user.matric}</span>
                              </div>
                            )}
                            {user.activeSessionId ? (
                              <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-1">
                                <span className="text-slate-500 text-[9px] font-semibold uppercase">Session ID:</span>
                                <span className="text-indigo-400 font-bold font-mono select-all text-[9.5px]">{user.activeSessionId}</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-1">
                                <span className="text-slate-500 text-[9px] font-semibold uppercase">Session ID:</span>
                                <span className="text-slate-600 font-mono italic text-[9px]">unassigned</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 text-[9px] font-semibold uppercase">Default PWD:</span>
                              <span className="text-amber-400 font-mono font-semibold select-all bg-amber-500/10 px-1 rounded text-[9.5px]">{user.password || "123456"}</span>
                            </div>
                          </div>
                          {user.createdAt && (
                            <div className="font-mono text-[9px] text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              <span>Registered {new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions button group */}
                      <td className="py-4 px-5 text-right align-middle">
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center justify-end gap-1.5 animate-fadeIn">
                            <button
                              onClick={() => handleOpenEdit(user)}
                              aria-label="Edit user"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
                              title="Edit User Info"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user.id, user.displayName)}
                              aria-label="Delete user"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Quick Admin Toggles & Grants */}
                          <div className="flex flex-row flex-wrap items-center justify-end gap-1">
                            {/* Course Rep button trigger */}
                            <button
                              onClick={() => onUpdateUser(user.id, { isCourseRep: !user.isCourseRep, role: !user.isCourseRep ? "course_rep" : "user" })}
                              className={`px-1.5 py-0.5 rounded font-bold font-mono text-[8.5px] tracking-wide transition-all uppercase border cursor-pointer ${
                                user.isCourseRep 
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25" 
                                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600"
                              }`}
                              title={user.isCourseRep ? "Revoke Course Rep Status" : "Grant Course Rep Status"}
                            >
                              {user.isCourseRep ? "★ Course Rep" : "☆ Make Rep"}
                            </button>

                            {/* Direct Free Subscription Access Trigger */}
                            <button
                              onClick={() => onGrantSubscription(user.matric || user.id)}
                              className={`px-1.5 py-0.5 rounded font-bold font-mono text-[8.5px] tracking-wide transition-all uppercase border cursor-pointer ${
                                subStatus === "active"
                                  ? "bg-emerald-555/15 text-emerald-405 border-emerald-500/35 hover:bg-emerald-500/25"
                                  : "bg-indigo-650/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/25 hover:text-indigo-300"
                              }`}
                              title="Directly authorize 30 days full premium access"
                            >
                              {subStatus === "active" ? "🔄 30d Access (Renew)" : "⚡ Grant 30d"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add User Modal Dialog */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#111322] border border-white/[0.08] shadow-2xl rounded-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-sans">Add CRM Record</h3>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-950/40 border border-red-500/30 text-red-400 text-xs py-2 px-3 rounded-lg flex items-start gap-1.5 leading-relaxed">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 text-left">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Simon Davido"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-white rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-white rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Matric Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MAT-10293"
                    value={matric}
                    onChange={(e) => setMatric(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-white rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                
                <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl text-[10px] text-slate-450 leading-relaxed font-sans space-y-1">
                  <p className="font-semibold text-slate-300">💡 Automated Fields:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                    <li>Default password is auto-configured to <strong className="text-amber-400 font-mono">"123456"</strong></li>
                    <li>A random <strong className="text-indigo-400 font-mono">activeSessionId</strong> is generated</li>
                    <li>Creation timestamp is synchronized automatically</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-[#181a2e] border border-white/[0.08] hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Writing..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal Dialog */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#111322] border border-white/[0.08] shadow-2xl rounded-2xl max-w-md w-full overflow-hidden text-left">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-sans">Modify Remote Record</h3>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-950/40 border border-red-500/30 text-red-400 text-xs py-2 px-3 rounded-lg flex items-start gap-1.5 leading-relaxed">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-[#181a2e] p-3 rounded-xl border border-white/[0.04] space-y-1">
                  <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Target User ID</span>
                  <span className="font-mono text-[10px] text-slate-400 select-all block break-all font-semibold">{editingUser.id}</span>
                  <span className="font-mono text-[9px] text-indigo-400 select-none block mt-1">📧 {editingUser.email}</span>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-white rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Matric Number</label>
                  <input
                    type="text"
                    value={editMatric}
                    placeholder="e.g. MAT-10293"
                    onChange={(e) => setEditMatric(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-white rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="moderator">Moderator</option>
                      <option value="developer">Developer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                      className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-white rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 bg-[#181a2e]/60 p-3 rounded-xl border border-white/[0.04]">
                  <input
                    type="checkbox"
                    id="editIsCourseRep"
                    checked={editIsCourseRep}
                    onChange={(e) => setEditIsCourseRep(e.target.checked)}
                    className="h-3.5 w-3.5 text-indigo-600 border-white/[0.1] rounded focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <label htmlFor="editIsCourseRep" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                    ✨ Designate as Course Representative (Rep role)
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Biography / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Log operational notes for this CRM index..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-[#181a2e] border border-white/[0.08] text-xs text-white rounded-xl px-3 py-2 focus:outline-hidden focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-[#181a2e] border border-white/[0.08] hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Commit Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#111322] border border-white/[0.08] shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden text-left">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-rose-950/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white font-sans">Confirm Delete Action</h3>
              </div>
              <button 
                onClick={() => {
                  if (!isDeleting) {
                    setDeletingUser(null);
                    setFormError("");
                  }
                }}
                disabled={isDeleting}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-950/40 border border-red-500/30 text-red-400 text-xs py-2 px-3 rounded-lg space-y-1">
                  <div className="flex items-start gap-1.5 leading-relaxed font-sans font-bold text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                    <span>Failed to Delete User</span>
                  </div>
                  <p className="text-[10px] pl-5 pr-1 text-slate-300 leading-normal">
                    {formError.includes("Missing or insufficient permissions") ? (
                      <span>
                        <strong>Firebase Permission Denied.</strong> To enable deletion in your cloud Firestore, please copy the rules from your local <code>firestore.rules</code> file and paste them into your Firebase Web Console under the Rules tab.
                      </span>
                    ) : (
                      formError
                    )}
                  </p>
                </div>
              )}

              <p className="text-slate-300 text-xs leading-relaxed">
                Are you absolutely sure you want to permanently delete user <strong className="text-white">"{deletingUser.name}"</strong>? This will remove their record from Cloud Firestore immediately.
              </p>
              
              <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl text-[10px] text-rose-300 font-mono">
                ⚠️ This action cannot be undone. All CRM profiles and metrics associated with this user will be purged.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setDeletingUser(null);
                    setFormError("");
                  }}
                  className="px-4 py-2 bg-[#181a2e] border border-white/[0.08] hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    const idToDelete = deletingUser.id;
                    setFormError("");
                    setIsDeleting(true);
                    try {
                      await onDeleteUser(idToDelete);
                      setDeletingUser(null);
                    } catch (err: any) {
                      setFormError(err.message || "Failed to delete user.");
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center min-w-[90px] disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
