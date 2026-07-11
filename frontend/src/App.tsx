import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Dashboard } from './components/Dashboard';
import { TimetableGrid } from './components/TimetableGrid';
import { LeavePanel } from './components/LeavePanel';
import { AdminConsole } from './components/AdminConsole';
import { 
  Sun, Moon, LogOut, LayoutDashboard, Calendar, 
  FileSpreadsheet, ShieldAlert, Cpu, Bell, Check, X, AlertCircle 
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, login, logout, token } = useAuth();
  const { notifications, toasts, removeToast } = useSocket();
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TIMETABLE' | 'LEAVE' | 'ADMIN'>('DASHBOARD');
  const [theme, setTheme] = useState<'light' | 'dark'>(localStorage.getItem('theme') as 'light' | 'dark' || 'dark');
  
  // Login input states
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    const success = await login(usernameInput, passwordInput);
    setLoginLoading(false);
    if (!success) {
      setLoginError('Invalid username or password.');
    }
  };

  const handleQuickLogin = async (username: string) => {
    setLoginLoading(true);
    setLoginError(null);
    const success = await login(username, 'password123');
    setLoginLoading(false);
    if (!success) {
      setLoginError('Demo login failed.');
    }
  };

  // If not logged in, show Login UI
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Decorative Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
              <Cpu className="h-7 w-7 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Smart Classroom Scheduler</h2>
            <p className="text-sm text-slate-400">AI-Powered Automatic Timetable optimization</p>
          </div>

          {loginError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Username</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. admin or cse_hod"
                className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm rounded-xl text-white outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm rounded-xl text-white outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
            >
              {loginLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Quick simulation accounts */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 text-center">Quick Simulation Logins</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickLogin('admin')}
                className="py-2 text-[10px] font-bold bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl transition-all"
              >
                Admin
              </button>
              <button
                onClick={() => handleQuickLogin('cse_hod')}
                className="py-2 text-[10px] font-bold bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl transition-all"
              >
                CSE HOD
              </button>
              <button
                onClick={() => handleQuickLogin('ece_hod')}
                className="py-2 text-[10px] font-bold bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl transition-all"
              >
                ECE HOD
              </button>
            </div>
            
            <div>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleQuickLogin(e.target.value);
                    e.target.value = ''; // reset selection
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 px-3 py-2 text-[10px] font-bold text-slate-300 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Quick Sign-in as Any Faculty --</option>
                <optgroup label="Computer Science (CSE)">
                  <option value="cse_fac1">Prof. John Doe (CSE_FAC1)</option>
                  <option value="cse_fac2">Dr. Sarah Connor (CSE_FAC2)</option>
                  <option value="cse_fac3">Prof. Alan Turing (CSE_FAC3)</option>
                  <option value="cse_fac4">Dr. Grace Hopper (CSE_FAC4)</option>
                  <option value="cse_fac5">Prof. Ada Lovelace (CSE_FAC5)</option>
                </optgroup>
                <optgroup label="Electronics (ECE)">
                  <option value="ece_fac1">Dr. Nikola Tesla (ECE_FAC1)</option>
                  <option value="ece_fac2">Prof. Marie Curie (ECE_FAC2)</option>
                  <option value="ece_fac3">Dr. Richard Feynman (ECE_FAC3)</option>
                  <option value="ece_fac4">Prof. Albert Einstein (ECE_FAC4)</option>
                </optgroup>
                <optgroup label="Mechanical (ME)">
                  <option value="me_hod">Dr. Rajesh Patel (ME_HOD)</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-card flex flex-col justify-between shrink-0">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20">
              <Cpu className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-sm block">Smart Classroom</span>
              <span className="text-[10px] text-muted-foreground font-semibold">SIH 2026 Sandbox</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                activeTab === 'DASHBOARD'
                  ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" /> Operations Dashboard
            </button>
            <button
              onClick={() => setActiveTab('TIMETABLE')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                activeTab === 'TIMETABLE'
                  ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="h-4 w-4" /> Timetables Grid
            </button>
            <button
              onClick={() => setActiveTab('LEAVE')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                activeTab === 'LEAVE'
                  ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" /> Leave Management
            </button>
            {user.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('ADMIN')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                  activeTab === 'ADMIN'
                    ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldAlert className="h-4 w-4" /> Admin Console
              </button>
            )}
          </nav>
        </div>

        {/* User Card */}
        <div className="p-4 border-t space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">{user.name}</span>
              <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-extrabold mt-1 inline-block uppercase">
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-muted-foreground hover:text-rose-500 bg-background hover:bg-rose-500/10 border rounded-lg transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen relative">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b px-8 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Engine connected</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 border rounded-xl hover:bg-muted bg-card transition-all"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Active Tab Screen */}
        <div className="flex-1 p-8">
          {activeTab === 'DASHBOARD' && <Dashboard />}
          {activeTab === 'TIMETABLE' && <TimetableGrid />}
          {activeTab === 'LEAVE' && <LeavePanel />}
          {activeTab === 'ADMIN' && <AdminConsole />}
        </div>
      </main>

      {/* Visual Toasts Display */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-2xl shadow-xl flex items-start gap-3 border animate-slide-in text-white ${
              toast.type === 'ALERT' ? 'bg-rose-600 border-rose-500' :
              toast.type === 'SUCCESS' ? 'bg-emerald-600 border-emerald-500' :
              'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'ALERT' ? <AlertCircle className="h-5 w-5" /> :
               toast.type === 'SUCCESS' ? <Check className="h-5 w-5" /> :
               <Bell className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-white/60 hover:text-white shrink-0 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
};
export default App;
