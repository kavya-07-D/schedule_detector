import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  Users, UserCheck, UserX, Calendar, RefreshCw, 
  FileText, Home, Activity, Check, X, AlertTriangle 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, 
  Pie, Cell, LineChart, Line 
} from 'recharts';

interface AnalyticsData {
  metrics: {
    totalFaculty: number;
    presentFaculty: number;
    absentFaculty: number;
    todayClasses: number;
    rescheduledClasses: number;
    pendingLeaves: number;
    classroomUtilization: number;
    labUtilization: number;
  };
  charts: {
    facultyWorkloads: Array<{ id: string; name: string; weeklyWorkload: number; maxWorkload: number }>;
    departmentWorkloads: Array<{ name: string; workload: number }>;
    attendanceTrends: Array<{ name: string; Present: number; Absent: number }>;
  };
  notifications: Array<{ id: string; message: string; type: string; createdAt: string }>;
}

export const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [daySelection, setDaySelection] = useState(1); // Monday

  const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const fetchData = async () => {
    try {
      const resData = await fetch('http://localhost:5000/api/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resFaculty = await fetch('http://localhost:5000/api/faculty', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (resData.ok && resFaculty.ok) {
        const d = await resData.json();
        const f = await resFaculty.json();
        setData(d);
        setFaculties(f);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (socket) {
      socket.on('timetable_updated', fetchData);
      socket.on('notification', fetchData);
    }

    return () => {
      if (socket) {
        socket.off('timetable_updated', fetchData);
        socket.off('notification', fetchData);
      }
    };
  }, [token, socket]);

  const toggleFacultyStatus = async (facultyId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/faculty/${facultyId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus, day: daySelection })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const metrics = data?.metrics;
  const charts = data?.charts;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Academic Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time scheduling monitoring and optimization panel.</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'HOD') && (
          <div className="flex items-center gap-2 bg-card border px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">Demo Simulation Target:</span>
            <select 
              value={daySelection} 
              onChange={(e) => setDaySelection(Number(e.target.value))}
              className="bg-transparent border-0 text-sm font-bold focus:ring-0 cursor-pointer"
            >
              <option value={1}>Monday (Day 1)</option>
              <option value={2}>Tuesday (Day 2)</option>
              <option value={3}>Wednesday (Day 3)</option>
              <option value={4}>Thursday (Day 4)</option>
              <option value={5}>Friday (Day 5)</option>
            </select>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Faculty</p>
                <h3 className="text-3xl font-bold mt-2">{metrics.totalFaculty}</h3>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950 p-3 rounded-xl text-indigo-500 group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-xs font-semibold">
              <span className="text-emerald-500 flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5" /> {metrics.presentFaculty} Active
              </span>
              <span className="text-rose-500 flex items-center gap-1">
                <UserX className="h-3.5 w-3.5" /> {metrics.absentFaculty} Absent
              </span>
            </div>
          </div>

          <div className="bg-card border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Lectures</p>
                <h3 className="text-3xl font-bold mt-2">{metrics.todayClasses}</h3>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 text-xs font-semibold">
              {metrics.rescheduledClasses > 0 ? (
                <span className="text-amber-500 flex items-center gap-1">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '6s' }} /> {metrics.rescheduledClasses} Rescheduled by AI
                </span>
              ) : (
                <span className="text-emerald-500 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> All Classes Stable
                </span>
              )}
            </div>
          </div>

          <div className="bg-card border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Classroom Utilization</p>
                <h3 className="text-3xl font-bold mt-2">{metrics.classroomUtilization}%</h3>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                <Home className="h-6 w-6" />
              </div>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${metrics.classroomUtilization}%` }}></div>
            </div>
          </div>

          <div className="bg-card border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Laboratory Utilization</p>
                <h3 className="text-3xl font-bold mt-2">{metrics.labUtilization}%</h3>
              </div>
              <div className="bg-violet-50 dark:bg-violet-950 p-3 rounded-xl text-violet-500 group-hover:scale-110 transition-transform">
                <Activity className="h-6 w-6" />
              </div>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-violet-500 h-full rounded-full transition-all duration-500" style={{ width: `${metrics.labUtilization}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Section (Admin/HOD Only) */}
      {(user?.role === 'ADMIN' || user?.role === 'HOD') && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 p-6 rounded-2xl glow-primary">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-indigo-500" /> SIH Demo Simulation Console
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate faculty absenteeism. Toggle a faculty member's attendance to trigger the AI-scheduling reallocation system instantly.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            {faculties.map((fac) => (
              <button
                key={fac.id}
                onClick={() => toggleFacultyStatus(fac.id, fac.status)}
                className={`flex flex-col items-center justify-between p-3 border rounded-xl transition-all shadow-sm ${
                  fac.status === 'PRESENT'
                    ? 'bg-card text-foreground hover:bg-rose-500/5 hover:border-rose-500/30'
                    : 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 hover:bg-emerald-500/5 hover:border-emerald-500/30'
                }`}
              >
                <span className="text-xs font-bold truncate max-w-full">{fac.name}</span>
                <span className="text-[10px] text-muted-foreground mt-1">{fac.id} ({fac.departmentId})</span>
                <span className={`text-[10px] font-extrabold mt-2 px-2 py-0.5 rounded-full ${
                  fac.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20'
                }`}>
                  {fac.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Graphs & Charts Grid */}
      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workload Balancer Chart */}
          <div className="bg-card border p-6 rounded-2xl shadow-sm lg:col-span-2">
            <h3 className="text-lg font-bold mb-4">Faculty Workload Balancer</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.facultyWorkloads} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 20]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    formatter={(value: any, name: any) => [value, name === 'weeklyWorkload' ? 'Assigned Periods' : 'Max Limit']}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="weeklyWorkload" name="Assigned Periods" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="maxWorkload" name="Max Workload Limit" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} className="dark:fill-slate-700" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Share Pie Chart */}
          <div className="bg-card border p-6 rounded-2xl shadow-sm">
            <h3 className="text-lg font-bold mb-4">Department Workload Distribution</h3>
            <div className="h-[300px] flex flex-col justify-between">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.departmentWorkloads}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="workload"
                    >
                      {charts.departmentWorkloads.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                {charts.departmentWorkloads.map((dept, index) => (
                  <div key={dept.name} className="flex flex-col items-center">
                    <span className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="font-bold text-foreground">{dept.name}</span>
                    <span className="text-muted-foreground">{dept.workload} Periods</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs & Trends Grid */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications feed */}
          <div className="bg-card border p-6 rounded-2xl shadow-sm lg:col-span-2 flex flex-col h-[380px]">
            <h3 className="text-lg font-bold mb-4">System Optimization Log</h3>
            <div className="overflow-y-auto flex-1 space-y-3 pr-2">
              {data.notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-8 w-8 stroke-[1.5] mb-2" />
                  <p className="text-sm">No scheduling logs available yet.</p>
                </div>
              ) : (
                data.notifications.map((notif) => (
                  <div key={notif.id} className="flex items-start gap-3 p-3 bg-muted/30 border rounded-xl hover:bg-muted/50 transition-colors">
                    <div className={`p-1.5 rounded-lg mt-0.5 ${
                      notif.type === 'ALERT' ? 'bg-rose-500/10 text-rose-500' :
                      notif.type === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' :
                      'bg-indigo-500/10 text-indigo-500'
                    }`}>
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground leading-relaxed">{notif.message}</p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Attendance trends */}
          {charts && (
            <div className="bg-card border p-6 rounded-2xl shadow-sm">
              <h3 className="text-lg font-bold mb-4">Faculty Attendance Trends</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.attendanceTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
