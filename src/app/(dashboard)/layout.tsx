'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  GraduationCap, LayoutDashboard, FileSpreadsheet, Calendar,
  Users, ScanLine, ShieldCheck, AlertTriangle, BarChart3,
  LogOut, Menu, X, ChevronRight, UserCog,
} from 'lucide-react';
import type { Profile } from '@/types';
import { SIDEBAR_MENU, APP_NAME } from '@/lib/constants';

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  GraduationCap: <GraduationCap className="w-4 h-4" />,
  FileSpreadsheet: <FileSpreadsheet className="w-4 h-4" />,
  Calendar: <Calendar className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  ScanLine: <ScanLine className="w-4 h-4" />,
  ShieldCheck: <ShieldCheck className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  BarChart3: <BarChart3 className="w-4 h-4" />,
  UserCog: <UserCog className="w-4 h-4" />,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data as Profile);
      setLoading(false);
    };
    fetchProfile();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const menuItems = profile?.role && SIDEBAR_MENU[profile.role] ? SIDEBAR_MENU[profile.role] : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 mb-4 animate-pulse">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <p className="text-surface-200/60 text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-surface-950 p-2 sm:p-4 lg:p-6 gap-6 font-sans">
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-all" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-4 left-4 z-50 w-72 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-surface-200/50 flex flex-col overflow-hidden transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0'} lg:h-[calc(100vh-3rem)] h-[calc(100vh-2rem)]`}>
        <div className="p-6 border-b border-surface-200/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-surface-100 truncate">{APP_NAME}</h1>
              <p className="text-[10px] text-primary-500 font-bold uppercase tracking-widest">Attendance System</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-surface-200 hover:text-surface-100 bg-surface-900 p-2 rounded-full"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <nav className="flex-1 p-5 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                {iconMap[item.icon] || <ChevronRight className="w-4 h-4" />}
                <span>{item.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-surface-200/30 bg-surface-900/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-md shadow-primary-500/20 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-surface-100 truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-primary-500 font-bold uppercase tracking-wider">{profile?.role}</p>
            </div>
          </div>
          <button id="logout-button" onClick={handleLogout} className="flex items-center justify-center gap-2 text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors w-full py-2.5 rounded-xl border border-red-100">
            <LogOut className="w-4 h-4" /><span>Keluar Akses</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-surface-200/50 overflow-hidden lg:h-[calc(100vh-3rem)] h-[calc(100vh-2rem)]">
        <header className="h-20 flex items-center justify-between px-8 border-b border-surface-200/30 bg-white/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-surface-100 hover:bg-surface-900 p-2 rounded-xl transition-colors"><Menu className="w-5 h-5" /></button>
            <div className="hidden lg:flex items-center gap-2 text-sm font-semibold text-surface-200 tracking-wide">{menuItems.find((i) => i.href === pathname)?.label || 'Dashboard'}</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-surface-200 hidden sm:inline">{profile?.email}</span>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 sm:p-8 overflow-auto bg-surface-950/40">{children}</main>
      </div>
    </div>
  );
}
