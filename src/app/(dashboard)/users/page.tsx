'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Users, Plus, Loader2, Trash2, Edit2, X, Save, 
  Mail, Shield, User, AlertCircle, CheckCircle2, Search, RefreshCw
} from 'lucide-react';
import { useToast } from '@/app/components/ui/Toast';
import type { Profile } from '@/types';
import { ROLE_OPTIONS } from '@/lib/constants';

interface UserFormData {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'absenter' | 'mahasiswa';
}

export default function UsersPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');

  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    full_name: '',
    role: 'absenter',
  });

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    role: 'absenter' as 'admin' | 'absenter' | 'mahasiswa',
  });

  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (filterRole) {
      query = query.eq('role', filterRole);
    }

    const { data, error } = await query;
    if (!error && data) {
      setUsers(data as Profile[]);
    }
    setLoading(false);
  }, [supabase, search, filterRole]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Validasi
    if (!formData.email || !formData.password || !formData.full_name) {
      setError('Semua field harus diisi');
      setIsSubmitting(false);
      return;
    }
    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      setIsSubmitting(false);
      return;
    }

    try {
      // Create user using Supabase Auth Admin API via server action
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal membuat user');
      }

      toastSuccess('User berhasil dibuat!');
      setShowModal(false);
      setFormData({ email: '', password: '', full_name: '', role: 'absenter' });
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFormData.full_name,
          role: editFormData.role,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toastSuccess('User berhasil diupdate!');
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menghapus user');
      }

      toastSuccess('User berhasil dihapus!');
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setEditFormData({
      full_name: user.full_name,
      role: user.role,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (user: Profile) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      absenter: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      mahasiswa: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };
    const labels: Record<string, string> = {
      admin: 'Admin',
      absenter: 'Absenter',
      mahasiswa: 'Mahasiswa',
    };
    return (
      <span className={`badge ${colors[role] || 'border-surface-200/20'}`}>
        {labels[role] || role}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Manajemen Pengguna</h1>
          <p className="text-surface-200/50 text-sm mt-1">Kelola akun admin, absenter, dan mahasiswa</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Buat User Baru</span>
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="input-field"
          >
            <option value="">Semua Role</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={fetchUsers}
          className="btn-secondary flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary-400 mb-2" />
              <p className="text-surface-200/50 text-sm">Memuat data...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Users className="w-12 h-12 text-surface-200/20 mb-4" />
              <p className="text-surface-100 font-medium">Belum ada user</p>
              <p className="text-surface-200/50 text-sm mt-1">Buat user baru untuk mulai</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-semibold">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-surface-100">{user.full_name}</p>
                          <p className="text-xs text-surface-200/50">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-surface-200/40" />
                        <span className="text-surface-200">{user.email}</span>
                      </div>
                    </td>
                    <td>{getRoleBadge(user.role)}</td>
                    <td>
                      <span className="text-surface-200/60 text-sm">
                        {new Date(user.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-surface-200/60 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          className="p-2 text-surface-200/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Hapus User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6 border-b border-surface-200/10 pb-4">
              <h2 className="text-xl font-bold text-surface-100">Buat User Baru</h2>
              <button onClick={() => setShowModal(false)} className="text-surface-200/40 hover:text-surface-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                  className="input-field"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="input-field"
                  placeholder="user@university.ac.id"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    className="input-field"
                    placeholder="Min. 6 karakter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Role</label>
                  <select
                    required
                    value={formData.role}
                    onChange={e => setFormData(p => ({ ...p, role: e.target.value as any }))}
                    className="input-field"
                  >
                    {ROLE_OPTIONS.filter(r => r.value !== 'mahasiswa').map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200/10 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Buat User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6 border-b border-surface-200/10 pb-4">
              <h2 className="text-xl font-bold text-surface-100">Edit User</h2>
              <button onClick={() => setShowEditModal(false)} className="text-surface-200/40 hover:text-surface-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={e => setEditFormData(p => ({ ...p, full_name: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Email (Tidak dapat diubah)</label>
                <input
                  type="email"
                  disabled
                  value={selectedUser.email}
                  className="input-field opacity-50 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Role</label>
                <select
                  required
                  value={editFormData.role}
                  onChange={e => setEditFormData(p => ({ ...p, role: e.target.value as any }))}
                  className="input-field"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200/10 mt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative glass-card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-surface-100 mb-2">Hapus User?</h2>
            <p className="text-surface-200/60 text-sm mb-6">
              Anda akan menghapus user <strong className="text-surface-100">{selectedUser.full_name}</strong> ({selectedUser.email}).
              <br />Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button 
                onClick={handleDelete} 
                disabled={isSubmitting}
                className="btn-danger flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
