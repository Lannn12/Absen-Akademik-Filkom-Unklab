'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  GraduationCap, LayoutDashboard, FileSpreadsheet, Calendar,
  Users, ScanLine, ShieldCheck, AlertTriangle, BarChart3,
  LogOut, Menu, X, ChevronRight,
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
    <div className="min-h-screen flex bg-surface-950">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-surface-900/95 backdrop-blur-xl border-r border-primary-500/10 flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-primary-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold gradient-text truncate">{APP_NAME}</h1>
              <p className="text-[10px] text-surface-200/40 uppercase tracking-widest">Attendance System</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-surface-200/40 hover:text-surface-200"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                {iconMap[item.icon] || <ChevronRight className="w-4 h-4" />}
                <span>{item.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary-500/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-violet to-primary-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-surface-100 truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-primary-400 font-medium capitalize">{profile?.role}</p>
            </div>
          </div>
          <button id="logout-button" onClick={handleLogout} className="flex items-center gap-2 text-sm text-surface-200/50 hover:text-red-400 transition-colors w-full py-2 px-3 rounded-lg hover:bg-red-500/5">
            <LogOut className="w-4 h-4" /><span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-primary-500/10 bg-surface-900/50 backdrop-blur-lg sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-surface-200/60 hover:text-surface-100"><Menu className="w-5 h-5" /></button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-surface-200/50">{menuItems.find((i) => i.href === pathname)?.label || 'Dashboard'}</div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-surface-200/40 hidden sm:inline">{profile?.email}</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-semibold text-xs">{profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}</div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
