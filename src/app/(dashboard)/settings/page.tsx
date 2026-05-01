'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { Camera, Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fullName, setFullName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data as Profile);
        setFullName(data.full_name || '');
      }
      setLoading(false);
    };
    fetchProfile();
  }, [supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile.id);
        
      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Profil berhasil diperbarui. Silakan refresh halaman jika nama di sidebar belum berubah.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan profil.' });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'File harus berupa gambar (JPG, PNG, dll).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ukuran gambar maksimal 5MB.' });
      return;
    }

    setUploadingImage(true);
    setMessage(null);

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update Profile Table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // 4. Update local state
      setProfile({ ...profile, avatar_url: publicUrl });
      setMessage({ type: 'success', text: 'Foto profil berhasil diunggah! Silakan refresh halaman agar foto baru muncul di menu sidebar.' });
      
    } catch (err: any) {
      console.error('Upload Error:', err);
      // Jika errornya terkait storage, beri pesan khusus
      if (err.message?.includes('Bucket not found') || err.message?.includes('row-level security')) {
         setMessage({ type: 'error', text: 'Gagal mengunggah. Pastikan Anda telah membuat bucket "avatars" di Supabase Storage dan mengaturnya sebagai Public!' });
      } else {
         setMessage({ type: 'error', text: err.message || 'Gagal mengunggah foto profil.' });
      }
    } finally {
      setUploadingImage(false);
      // Reset input file
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-surface-200/50">
        <h1 className="text-2xl font-bold text-surface-100 mb-8">Pengaturan Profil</h1>
        
        {message && (
          <div className={`p-4 rounded-xl mb-6 flex gap-3 items-start border ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-8 items-start mb-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-900 border-4 border-white shadow-xl shadow-surface-200/50 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-surface-200">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                
                {/* Loading Overlay */}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  </div>
                )}
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 px-4 py-2 rounded-lg transition-colors"
            >
              Ubah Foto
            </button>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSaveProfile} className="flex-1 space-y-4 w-full">
            <div>
              <label className="block text-xs font-bold text-surface-200 mb-2 uppercase tracking-wide">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-surface-200 mb-2 uppercase tracking-wide">
                Email
              </label>
              <input
                type="text"
                value={profile?.email || ''}
                className="input-field bg-surface-50 text-surface-200 cursor-not-allowed"
                disabled
              />
              <p className="text-[10px] text-surface-200/60 mt-1">Email tidak dapat diubah.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-200 mb-2 uppercase tracking-wide">
                Peran (Role)
              </label>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-50 text-primary-600">
                {profile?.role}
              </div>
            </div>

            <div className="pt-4 border-t border-surface-200/30">
              <button
                type="submit"
                disabled={saving || fullName === profile?.full_name}
                className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
