'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Plus, Trash2, Loader2, UserPlus, X, Search, GraduationCap } from 'lucide-react';
import { useToast } from '@/app/components/ui/Toast';
import type { AbsenterGroup, Profile, AbsenterMember, Mahasiswa } from '@/types';

export default function AbsenterPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [groups, setGroups] = useState<AbsenterGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<AbsenterMember[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  const [addingMember, setAddingMember] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');

  // Search Mahasiswa logic
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingMhs, setIsSearchingMhs] = useState(false);
  const [mhsResults, setMhsResults] = useState<Mahasiswa[]>([]);

  const supabase = createClient();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('absenter_group')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setGroups(data as AbsenterGroup[]);
    setLoading(false);
  }, [supabase]);

  const fetchMembers = useCallback(async (groupId: string) => {
    setLoadingMembers(true);
    const { data: memberData } = await supabase
      .from('absenter_members')
      .select('id, user_id, group_id, mahasiswa_id, created_at, profiles(full_name, role), mahasiswa(first_name, last_name, no_registrasi)')
      .eq('group_id', groupId);
      
    if (memberData) {
      const mapped = memberData.map(m => ({
        ...m,
        profile: m.profiles,
        mahasiswa: m.mahasiswa
      })) as any[];
      setMembers(mapped);
    }
    setLoadingMembers(false);
  }, [supabase]);

  const fetchAvailableProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'absenter'])
      .order('full_name');
    
    if (data) setAvailableProfiles(data as Profile[]);
  }, [supabase]);

  useEffect(() => {
    fetchGroups();
    fetchAvailableProfiles();
  }, [fetchGroups, fetchAvailableProfiles]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchMembers(selectedGroupId);
    } else {
      setMembers([]);
    }
  }, [selectedGroupId, fetchMembers]);

  const handleSearchMhs = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 3) {
      setMhsResults([]);
      return;
    }

    setIsSearchingMhs(true);
    const { data } = await supabase
      .from('mahasiswa')
      .select('*')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,no_registrasi.ilike.%${q}%`)
      .limit(5);
    
    if (data) setMhsResults(data as Mahasiswa[]);
    setIsSearchingMhs(false);
  };

  const handlePromoteMhs = async (mhs: Mahasiswa) => {
    if (!selectedGroupId) return;
    
    setAddingMember(true);
    try {
      // Direct insertion using mahasiswa_id, no email/profile check needed!
      const { error } = await supabase
        .from('absenter_members')
        .insert([{ 
          group_id: selectedGroupId, 
          mahasiswa_id: mhs.id 
        }]);

      if (!error) {
        toastSuccess(`${mhs.first_name} berhasil ditambahkan ke grup`);
        setSearchQuery('');
        setMhsResults([]);
        fetchMembers(selectedGroupId);
      } else {
        if (error.code === '23505') toastError('Mahasiswa sudah ada di grup ini');
        else throw error;
      }
    } catch (err) {
      console.error(err);
      toastError('Gagal menambahkan mahasiswa ke grup');
    } finally {
      setAddingMember(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    setIsCreatingGroup(true);
    const { error } = await supabase
      .from('absenter_group')
      .insert([{ nama_group: newGroupName.trim() }]);
      
    if (!error) {
      setNewGroupName('');
      toastSuccess('Grup berhasil dibuat');
      fetchGroups();
    } else {
      toastError('Gagal membuat grup');
    }
    setIsCreatingGroup(false);
  };

  const handleDeleteGroup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Yakin ingin menghapus grup ini?')) return;
    
    await supabase.from('absenter_group').delete().eq('id', id);
    if (selectedGroupId === id) setSelectedGroupId(null);
    fetchGroups();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedProfileId) return;
    
    setAddingMember(true);
    const { error } = await supabase
      .from('absenter_members')
      .insert([{ group_id: selectedGroupId, user_id: selectedProfileId }]);
      
    if (!error) {
      toastSuccess('Anggota berhasil ditambahkan');
      setSelectedProfileId('');
      fetchMembers(selectedGroupId);
    } else {
      if (error.code === '23505') toastError('Sudah ada dalam grup');
      else toastError('Gagal menambahkan');
    }
    setAddingMember(false);
  };

  const handleRemoveMember = async (id: string) => {
    if (!selectedGroupId) return;
    await supabase.from('absenter_members').delete().eq('id', id);
    fetchMembers(selectedGroupId);
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Absenter Group</h1>
          <p className="text-surface-200/50 text-sm mt-1">Kelola kelompok petugas absensi (BEM)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-surface-100 mb-4">Daftar Group</h2>
            <form onSubmit={handleCreateGroup} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Nama grup baru..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="input-field py-2"
                required
              />
              <button type="submit" disabled={isCreatingGroup || !newGroupName.trim()} className="btn-primary py-2 px-3">
                {isCreatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-primary-400" /></div>
              ) : groups.length === 0 ? (
                <p className="text-center text-sm text-surface-200/40 py-4">Belum ada grup</p>
              ) : (
                groups.map(group => (
                  <div 
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedGroupId === group.id 
                        ? 'bg-primary-500/10 border-primary-500/30' 
                        : 'bg-surface-800/50 border-surface-200/10 hover:border-primary-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Users className="w-4 h-4 text-primary-400" />
                      <span className="font-medium text-sm text-surface-100 truncate">{group.nama_group}</span>
                    </div>
                    <button onClick={(e) => handleDeleteGroup(group.id, e)} className="p-1.5 text-surface-200/30 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="glass-card h-full p-6 flex flex-col min-h-[500px]">
            {!selectedGroupId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Users className="w-12 h-12 text-surface-200/20 mb-4" />
                <p className="text-surface-100 font-medium">Pilih Grup</p>
                <p className="text-surface-200/50 text-sm mt-1">Pilih grup di panel kiri untuk mengelola anggota petugas</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-200/10">
                  <div>
                    <h2 className="text-lg font-bold text-surface-100">{selectedGroup?.nama_group}</h2>
                    <p className="text-sm text-surface-200/50">Total Anggota: {members.length}</p>
                  </div>
                </div>

                {/* SEARCH MAHASISWA (NEW) */}
                <div className="mb-8 p-4 rounded-2xl bg-primary-500/5 border border-primary-500/10">
                  <label className="block text-xs font-bold text-primary-400 uppercase tracking-wider mb-3">
                    Cari Anggota BEM dari Data Mahasiswa
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
                    <input
                      type="text"
                      placeholder="Ketik Nama atau NIM mahasiswa..."
                      value={searchQuery}
                      onChange={(e) => handleSearchMhs(e.target.value)}
                      className="input-field pl-9"
                    />
                  </div>

                  {mhsResults.length > 0 && (
                    <div className="mt-3 space-y-2 animate-in slide-in-from-top-2">
                      {mhsResults.map(mhs => (
                        <div key={mhs.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-900 border border-surface-200/10">
                          <div className="flex items-center gap-3">
                            <GraduationCap className="w-4 h-4 text-primary-400" />
                            <div>
                              <p className="text-sm font-medium text-surface-100">{mhs.first_name} {mhs.last_name}</p>
                              <p className="text-[10px] text-surface-200/50">{mhs.no_registrasi} • {mhs.program_study_code}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handlePromoteMhs(mhs)}
                            disabled={addingMember}
                            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2"
                          >
                            {addingMember ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            Jadikan Petugas
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 3 && mhsResults.length === 0 && !isSearchingMhs && (
                    <p className="mt-2 text-xs text-surface-200/40 text-center italic">Mahasiswa tidak ditemukan</p>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-xs font-bold text-surface-200/40 uppercase tracking-wider mb-4">Anggota Terdaftar</h3>
                  {loadingMembers ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-10 text-surface-200/40 text-sm">Belum ada anggota di grup ini</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-200/10 bg-surface-800/30">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-violet to-primary-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                              {(member.mahasiswa?.first_name || member.profile?.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-surface-100 truncate">
                                {member.mahasiswa ? `${member.mahasiswa.first_name} ${member.mahasiswa.last_name}` : member.profile?.full_name}
                              </p>
                              <p className="text-[10px] text-primary-400 capitalize">
                                {member.mahasiswa ? `NIM: ${member.mahasiswa.no_registrasi}` : member.profile?.role}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1.5 text-surface-200/40 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

