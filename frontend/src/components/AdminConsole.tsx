import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { useSocket } from '../context/SocketContext';
import { Shield, BookOpen, Layers, Users, Sliders, CheckCircle2, AlertTriangle, Plus, Home } from 'lucide-react';

interface Faculty {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  weeklyWorkload: number;
  maxWorkload: number;
  availablePeriods: string;
  preferredHours: string;
  status: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  primaryFacultyId: string;
  secondaryFacultyId: string;
  reserveFacultyId: string;
  isLab: boolean;
  weeklyPeriods: number;
}

interface Room {
  id: string;
  name: string;
  type: string;
  capacity: number;
  departmentId: string;
}

export const AdminConsole: React.FC = () => {
  const { token, user } = useAuth();
  const { addToast } = useSocket();
  const [activeTab, setActiveTab] = useState<'FACULTY' | 'ROOMS' | 'SUBJECTS' | 'RULES'>('FACULTY');
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  // Scheduling Rules State
  const [rules, setRules] = useState({
    maxDailyConsecutiveHours: 3,
    minDailyBreakHours: 1,
    optimizeLabsContinuity: true,
    prioritizeWorkloadBalance: true
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const resFaculty = await fetch(`${API_URL}/api/faculty`, { headers: { Authorization: `Bearer ${token}` } });
      const resTimetable = await fetch(`${API_URL}/api/timetable`, { headers: { Authorization: `Bearer ${token}` } });
      
      if (resFaculty.ok) {
        const facs = await resFaculty.json();
        setFaculties(facs);
      }

      // Prepopulate local presentation list of rooms and subjects
      setRooms([
        { id: 'CR101', name: 'Classroom 101', type: 'CLASSROOM', capacity: 60, departmentId: 'CSE' },
        { id: 'CR102', name: 'Classroom 102', type: 'CLASSROOM', capacity: 60, departmentId: 'CSE' },
        { id: 'CR201', name: 'Classroom 201', type: 'CLASSROOM', capacity: 60, departmentId: 'ECE' },
        { id: 'CR202', name: 'Classroom 202', type: 'CLASSROOM', capacity: 60, departmentId: 'ECE' },
        { id: 'CSE_LAB', name: 'Advanced CSE Laboratory', type: 'LAB', capacity: 40, departmentId: 'CSE' },
        { id: 'ECE_LAB', name: 'DSP & Microcontroller Lab', type: 'LAB', capacity: 40, departmentId: 'ECE' }
      ]);

      setSubjects([
        { id: 'CSE-DS', name: 'Data Structures & Algorithms', code: 'CS301', departmentId: 'CSE', primaryFacultyId: 'CSE_FAC1', secondaryFacultyId: 'CSE_FAC2', reserveFacultyId: 'CSE_FAC3', isLab: false, weeklyPeriods: 4 },
        { id: 'CSE-DBMS', name: 'Database Management Systems', code: 'CS302', departmentId: 'CSE', primaryFacultyId: 'CSE_FAC2', secondaryFacultyId: 'CSE_FAC3', reserveFacultyId: 'CSE_FAC4', isLab: false, weeklyPeriods: 4 },
        { id: 'CSE-CN', name: 'Computer Networks', code: 'CS303', departmentId: 'CSE', primaryFacultyId: 'CSE_FAC3', secondaryFacultyId: 'CSE_FAC4', reserveFacultyId: 'CSE_FAC5', isLab: false, weeklyPeriods: 3 },
        { id: 'CSE-OS', name: 'Operating Systems', code: 'CS304', departmentId: 'CSE', primaryFacultyId: 'CSE_FAC4', secondaryFacultyId: 'CSE_FAC5', reserveFacultyId: 'CSE_FAC1', isLab: false, weeklyPeriods: 3 },
        { id: 'CSE-DSLAB', name: 'Data Structures Lab', code: 'CS301L', departmentId: 'CSE', primaryFacultyId: 'CSE_FAC1', secondaryFacultyId: 'CSE_FAC3', reserveFacultyId: 'CSE_FAC4', isLab: true, weeklyPeriods: 2 },
        { id: 'ECE-LIC', name: 'Linear Integrated Circuits', code: 'EC301', departmentId: 'ECE', primaryFacultyId: 'ECE_FAC1', secondaryFacultyId: 'ECE_FAC2', reserveFacultyId: 'ECE_FAC3', isLab: false, weeklyPeriods: 4 },
        { id: 'ECE-DC', name: 'Digital Communication', code: 'EC302', departmentId: 'ECE', primaryFacultyId: 'ECE_FAC2', secondaryFacultyId: 'ECE_FAC3', reserveFacultyId: 'ECE_FAC4', isLab: false, weeklyPeriods: 4 },
        { id: 'ECE-DSP', name: 'Digital Signal Processing', code: 'EC303', departmentId: 'ECE', primaryFacultyId: 'ECE_FAC3', secondaryFacultyId: 'ECE_FAC4', reserveFacultyId: 'ECE_FAC1', isLab: false, weeklyPeriods: 4 }
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleUpdateRules = (e: React.FormEvent) => {
    e.preventDefault();
    addToast('Optimization engine configurations updated!', 'SUCCESS');
  };

  const handleAdjustWorkload = async (facId: string, value: number) => {
    setFaculties(prev => prev.map(f => {
      if (f.id === facId) {
        addToast(`Max workload for ${f.name} updated to ${value} periods.`, 'SUCCESS');
        return { ...f, maxWorkload: value };
      }
      return f;
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-indigo-500" /> Admin Console
        </h1>
        <p className="text-muted-foreground mt-1">Configure systemic fallbacks, rooms, and algorithmic constraints.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-px">
        <button
          onClick={() => setActiveTab('FACULTY')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'FACULTY' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" /> Faculty Directory
        </button>
        <button
          onClick={() => setActiveTab('ROOMS')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'ROOMS' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className="h-4 w-4" /> Rooms & Laboratories
        </button>
        <button
          onClick={() => setActiveTab('SUBJECTS')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'SUBJECTS' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="h-4 w-4" /> Subjects Setup
        </button>
        <button
          onClick={() => setActiveTab('RULES')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'RULES' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="h-4 w-4" /> Scheduling Rules
        </button>
      </div>

      {/* Loading bar */}
      {loading && faculties.length === 0 ? (
        <div className="flex justify-center py-20 bg-card border rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Faculty Tab */}
          {activeTab === 'FACULTY' && (
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b text-left">
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Faculty ID</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Name</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Department</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Status</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase text-center">Weekly Load</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase text-center w-[150px]">Max Workload</th>
                  </tr>
                </thead>
                <tbody>
                  {faculties.map((f) => (
                    <tr key={f.id} className="border-b last:border-b-0 hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-mono text-xs">{f.id}</td>
                      <td className="p-4 text-sm font-bold text-foreground">{f.name}</td>
                      <td className="p-4 text-sm font-semibold text-muted-foreground">{f.departmentId}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          f.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-center">
                        <span className={f.weeklyWorkload > f.maxWorkload ? 'text-rose-500' : 'text-foreground'}>
                          {f.weeklyWorkload} / {f.maxWorkload}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <input
                          type="number"
                          value={f.maxWorkload}
                          onChange={(e) => handleAdjustWorkload(f.id, Number(e.target.value))}
                          className="w-16 bg-muted/50 border rounded-lg text-center py-1 text-xs font-bold focus:bg-background"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rooms Tab */}
          {activeTab === 'ROOMS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((r) => (
                <div key={r.id} className="bg-card border p-5 rounded-2xl shadow-sm flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${r.type === 'LAB' ? 'bg-violet-500/10 text-violet-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    <Home className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{r.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">ID: {r.id} | Dept: {r.departmentId}</p>
                    <div className="flex gap-2 mt-3">
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold">
                        Cap: {r.capacity} Seats
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.type === 'LAB' ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {r.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === 'SUBJECTS' && (
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b text-left">
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Code</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Subject Name</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Primary Faculty</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Secondary Faculty</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase">Reserve Faculty</th>
                    <th className="p-4 text-xs font-bold text-muted-foreground uppercase text-center">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub) => (
                    <tr key={sub.id} className="border-b last:border-b-0 hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-mono text-xs font-bold">{sub.code}</td>
                      <td className="p-4 text-sm font-bold text-foreground">{sub.name}</td>
                      <td className="p-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400">{sub.primaryFacultyId}</td>
                      <td className="p-4 text-xs font-semibold text-teal-600 dark:text-teal-400">{sub.secondaryFacultyId}</td>
                      <td className="p-4 text-xs font-semibold text-amber-600 dark:text-amber-400">{sub.reserveFacultyId}</td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sub.isLab ? 'bg-violet-500/15 text-violet-500' : 'bg-slate-500/10 text-slate-500'
                        }`}>
                          {sub.isLab ? 'LAB' : 'LECTURE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'RULES' && (
            <div className="bg-card border p-6 rounded-2xl shadow-sm max-w-2xl">
              <h3 className="text-lg font-bold mb-4">Algorithmic Optimization Rules</h3>
              <form onSubmit={handleUpdateRules} className="space-y-5">
                <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-xl">
                  <div>
                    <label className="text-sm font-bold block">Max Daily Lecture Continuity</label>
                    <span className="text-xs text-muted-foreground">Limit consecutive period teaching block hours per faculty.</span>
                  </div>
                  <select
                    value={rules.maxDailyConsecutiveHours}
                    onChange={(e) => setRules(prev => ({ ...prev, maxDailyConsecutiveHours: Number(e.target.value) }))}
                    className="bg-background border rounded-lg p-1.5 text-xs font-bold focus:ring-0 outline-none"
                  >
                    <option value={2}>2 Hours Max</option>
                    <option value={3}>3 Hours Max</option>
                    <option value={4}>4 Hours Max</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-xl">
                  <div>
                    <label className="text-sm font-bold block">Min Daily Break Slots</label>
                    <span className="text-xs text-muted-foreground">Introduce mandatory idle periods between teaching blocks.</span>
                  </div>
                  <select
                    value={rules.minDailyBreakHours}
                    onChange={(e) => setRules(prev => ({ ...prev, minDailyBreakHours: Number(e.target.value) }))}
                    className="bg-background border rounded-lg p-1.5 text-xs font-bold focus:ring-0 outline-none"
                  >
                    <option value={0}>No limit</option>
                    <option value={1}>1 Slot Break</option>
                    <option value={2}>2 Slots Break</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-xl">
                  <div>
                    <label className="text-sm font-bold block">Preserve Laboratory Continuity</label>
                    <span className="text-xs text-muted-foreground">Always reschedule consecutive lab slots together to prevent splits.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={rules.optimizeLabsContinuity}
                    onChange={(e) => setRules(prev => ({ ...prev, optimizeLabsContinuity: e.target.checked }))}
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-xl">
                  <div>
                    <label className="text-sm font-bold block">Prioritize Workload Balance</label>
                    <span className="text-xs text-muted-foreground">Reschedule to faculties with lower current weekly assigned loads.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={rules.prioritizeWorkloadBalance}
                    onChange={(e) => setRules(prev => ({ ...prev, prioritizeWorkloadBalance: e.target.checked }))}
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow-sm hover:bg-primary/95 transition-all"
                >
                  Save Algorithmic Configurations
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
