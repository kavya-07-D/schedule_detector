import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Calendar, User, Home, Award, Download, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SlotData {
  id: string;
  day: number; // 1-5
  period: number; // 1-6
  classId: string;
  departmentId: string;
  subjectId: string;
  roomId: string;
  isLab: boolean;
  isRescheduled: boolean;
  reason: string | null;
  subject: { name: string; code: string };
  faculty: { name: string };
  originalFaculty?: { name: string } | null;
  room: { name: string };
}

export const TimetableGrid: React.FC = () => {
  const { token, user } = useAuth();
  const { socket, addToast } = useSocket();
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [filterType, setFilterType] = useState<'CLASS' | 'FACULTY' | 'ROOM' | 'DEPT'>('CLASS');
  const [filterValue, setFilterValue] = useState<string>('CSE-3A');
  const [viewMode, setViewMode] = useState<'WEEK' | 'DAY'>('WEEK');
  const [activeDay, setActiveDay] = useState<number>(1); // Monday for daily view
  
  const [options, setOptions] = useState<{
    classes: string[];
    faculties: { id: string; name: string }[];
    rooms: { id: string; name: string }[];
    departments: string[];
  }>({
    classes: ['CSE-3A', 'CSE-3B', 'ECE-3A'],
    faculties: [],
    rooms: [],
    departments: ['CSE', 'ECE', 'ME']
  });

  const [loading, setLoading] = useState(false);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const PERIODS = [1, 2, 3, 4, 5, 6];

  const fetchFilters = async () => {
    try {
      const resFaculty = await fetch('http://localhost:5000/api/faculty', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resRooms = await fetch('http://localhost:5000/api/analytics', { // reuse analytics to fetch rooms or hardcode
        headers: { Authorization: `Bearer ${token}` }
      });

      if (resFaculty.ok) {
        const facs = await resFaculty.json();
        setOptions(prev => ({
          ...prev,
          faculties: facs.map((f: any) => ({ id: f.id, name: f.name }))
        }));
      }

      // Hardcode rooms for easy mapping
      setOptions(prev => ({
        ...prev,
        rooms: [
          { id: 'CR101', name: 'Classroom 101' },
          { id: 'CR102', name: 'Classroom 102' },
          { id: 'CR201', name: 'Classroom 201' },
          { id: 'CR202', name: 'Classroom 202' },
          { id: 'CSE_LAB', name: 'Advanced CSE Lab' },
          { id: 'ECE_LAB', name: 'DSP Lab' }
        ]
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      let queryParam = '';
      if (filterType === 'CLASS') queryParam = `classId=${filterValue}`;
      else if (filterType === 'FACULTY') queryParam = `facultyId=${filterValue}`;
      else if (filterType === 'ROOM') queryParam = `roomId=${filterValue}`;
      else if (filterType === 'DEPT') queryParam = `departmentId=${filterValue}`;

      const res = await fetch(`http://localhost:5000/api/timetable?${queryParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, [token]);

  useEffect(() => {
    fetchTimetable();
  }, [filterType, filterValue]);

  useEffect(() => {
    if (socket) {
      socket.on('timetable_updated', fetchTimetable);
    }
    return () => {
      if (socket) {
        socket.off('timetable_updated', fetchTimetable);
      }
    };
  }, [socket, filterType, filterValue]);

  // Handle auto filter selection updates when type changes
  const handleFilterTypeChange = (type: typeof filterType) => {
    setFilterType(type);
    if (type === 'CLASS') setFilterValue(options.classes[0]);
    else if (type === 'FACULTY') setFilterValue(options.faculties[0]?.id || '');
    else if (type === 'ROOM') setFilterValue(options.rooms[0]?.id || '');
    else if (type === 'DEPT') setFilterValue(options.departments[0]);
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, slotId: string) => {
    if (user?.role !== 'ADMIN' && user?.role !== 'HOD') {
      e.preventDefault();
      return;
    }
    setDraggedSlotId(slotId);
    e.dataTransfer.setData('text/plain', slotId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetDay: number, targetPeriod: number) => {
    e.preventDefault();
    const slotId = draggedSlotId || e.dataTransfer.getData('text/plain');
    if (!slotId) return;

    setDraggedSlotId(null);
    setLoading(true);

    try {
      const draggedSlot = slots.find(s => s.id === slotId);
      if (!draggedSlot) return;

      const res = await fetch('http://localhost:5000/api/timetable/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          slotId,
          targetDay,
          targetPeriod,
          targetRoomId: draggedSlot.roomId // keep same room for dragging slot
        })
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Rescheduling failed', 'ALERT');
      } else {
        addToast('Class rescheduled successfully!', 'SUCCESS');
        fetchTimetable();
      }
    } catch (e) {
      console.error(e);
      addToast('Error while rescheduling class.', 'ALERT');
    } finally {
      setLoading(false);
    }
  };

  // Trigger automatic regeneration
  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const deptId = user?.role === 'HOD' && user.facultyId 
        ? user.facultyId.split('_')[0] 
        : 'CSE'; // default or match user department

      const res = await fetch('http://localhost:5000/api/timetable/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          departmentId: deptId,
          day: activeDay
        })
      });

      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Timetable regenerated successfully!', 'SUCCESS');
        fetchTimetable();
      } else {
        addToast(data.error || 'Regeneration failed', 'ALERT');
      }
    } catch (e) {
      console.error(e);
      addToast('Error during regeneration', 'ALERT');
    } finally {
      setLoading(false);
    }
  };

  // Export report to CSV
  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Day,Period,Class,Subject,Code,Faculty,Room,Status,Notes\r\n';

    slots.forEach(slot => {
      const status = slot.isRescheduled ? 'Rescheduled' : 'Regular';
      const notes = slot.reason ? slot.reason.replace(/,/g, ';') : '';
      csvContent += `${DAYS[slot.day - 1]},Period ${slot.period},${slot.classId},${slot.subject.name},${slot.subject.code},${slot.faculty.name},${slot.room.name},${status},${notes}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `timetable_report_${filterValue}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render cell contents
  const getCellSlot = (day: number, period: number) => {
    return slots.find(s => s.day === day && s.period === period);
  };

  return (
    <div className="space-y-6">
      {/* Filter and Control Bar */}
      <div className="bg-card border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterTypeChange('CLASS')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                filterType === 'CLASS' ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              <Award className="h-4 w-4" /> Class View
            </button>
            <button
              onClick={() => handleFilterTypeChange('FACULTY')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                filterType === 'FACULTY' ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              <User className="h-4 w-4" /> Faculty View
            </button>
            <button
              onClick={() => handleFilterTypeChange('ROOM')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                filterType === 'ROOM' ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              <Home className="h-4 w-4" /> Room View
            </button>
            <button
              onClick={() => handleFilterTypeChange('DEPT')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                filterType === 'DEPT' ? 'bg-primary border-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              <Calendar className="h-4 w-4" /> Dept View
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border hover:bg-muted transition-all"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            {(user?.role === 'ADMIN' || user?.role === 'HOD') && (
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
              >
                <RefreshCw className="h-4 w-4" /> Optimize Day {activeDay}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">Select Target:</span>
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="bg-background border px-3 py-1.5 text-sm font-bold rounded-xl outline-none"
            >
              {filterType === 'CLASS' && options.classes.map(c => <option key={c} value={c}>{c}</option>)}
              {filterType === 'FACULTY' && options.faculties.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
              {filterType === 'ROOM' && options.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              {filterType === 'DEPT' && options.departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setViewMode('WEEK')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'WEEK' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setViewMode('DAY')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'DAY' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Daily Grid
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {loading ? (
        <div className="flex justify-center py-20 bg-card border rounded-2xl shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : viewMode === 'WEEK' ? (
        // Weekly Grid View
        <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="p-4 text-left text-xs font-bold text-muted-foreground uppercase w-[120px]">Day</th>
                {PERIODS.map(p => (
                  <th key={p} className="p-4 text-center text-xs font-bold text-muted-foreground uppercase border-l">
                    Period {p}
                    <span className="block text-[10px] font-normal lowercase text-muted-foreground mt-0.5">
                      {p === 1 ? '9:00-10:00' : p === 2 ? '10:00-11:00' : p === 3 ? '11:15-12:15' : p === 4 ? '12:15-1:15' : p === 5 ? '2:00-3:00' : '3:00-4:00'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((dayName, dayIndex) => {
                const dayNum = dayIndex + 1;
                return (
                  <tr key={dayName} className="border-b last:border-b-0 hover:bg-muted/10 transition-colors">
                    <td className="p-4 font-bold text-sm bg-muted/10">{dayName}</td>
                    {PERIODS.map(periodNum => {
                      const slot = getCellSlot(dayNum, periodNum);
                      return (
                        <td
                          key={periodNum}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, dayNum, periodNum)}
                          className="p-3 text-center border-l min-h-[110px] relative transition-colors duration-150 drop-target hover:bg-indigo-500/5"
                        >
                          {slot ? (
                            <div
                              draggable={user?.role === 'ADMIN' || user?.role === 'HOD'}
                              onDragStart={(e) => handleDragStart(e, slot.id)}
                              className={`p-3 rounded-xl border flex flex-col justify-between h-full group text-left cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md transition-all ${
                                slot.isRescheduled
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-300'
                                  : 'bg-card text-foreground border-border hover:border-indigo-500/50'
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-start gap-1">
                                  <span className="text-xs font-bold uppercase truncate">{slot.subject.code}</span>
                                  {slot.isRescheduled && (
                                    <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title={slot.reason || ''}>
                                      <AlertCircle className="h-2 w-2" /> AI OPT
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-semibold truncate mt-1 text-foreground" title={slot.subject.name}>{slot.subject.name}</h4>
                              </div>

                              <div className="mt-3 space-y-0.5 text-[10px] text-muted-foreground font-medium">
                                <p className="truncate flex items-center gap-1"><User className="h-3 w-3 stroke-[2]" /> {slot.faculty.name}</p>
                                <p className="truncate flex items-center gap-1"><Home className="h-3 w-3 stroke-[2]" /> {slot.room.name}</p>
                                {filterType !== 'CLASS' && <p className="truncate font-bold text-primary">{slot.classId}</p>}
                              </div>

                              {slot.isRescheduled && slot.reason && (
                                <div className="absolute hidden group-hover:block bg-slate-900 text-slate-100 text-[10px] p-2 rounded-lg shadow-xl -bottom-10 left-4 z-25 max-w-[200px] border border-slate-700">
                                  {slot.reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-full min-h-[80px] flex items-center justify-center text-xs text-muted-foreground border border-dashed border-muted/50 rounded-xl">
                              Empty Slot
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Daily Grid View
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 p-1.5 bg-muted rounded-xl max-w-lg mx-auto">
            {DAYS.map((dayName, index) => (
              <button
                key={dayName}
                onClick={() => setActiveDay(index + 1)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeDay === index + 1 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                {dayName}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERIODS.map(periodNum => {
              const slot = getCellSlot(activeDay, periodNum);
              return (
                <div
                  key={periodNum}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, activeDay, periodNum)}
                  className="bg-card border p-4 rounded-2xl shadow-sm flex items-center gap-4 hover:border-indigo-500/50 hover:bg-muted/10 transition-all min-h-[100px]"
                >
                  <div className="bg-muted p-3 rounded-xl flex flex-col items-center justify-center w-16 text-center">
                    <span className="text-xs text-muted-foreground">Period</span>
                    <span className="text-lg font-bold text-foreground">{periodNum}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {slot ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-500 uppercase">{slot.subject.code}</span>
                          {slot.isRescheduled && (
                            <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title={slot.reason || ''}>
                              <AlertCircle className="h-2 w-2" /> AI OPT
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold truncate text-foreground">{slot.subject.name}</h4>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold">
                          <span>Fac: {slot.faculty.name}</span>
                          <span>Room: {slot.room.name}</span>
                        </div>
                        {slot.isRescheduled && slot.reason && (
                          <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 mt-1 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">{slot.reason}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground font-semibold py-4">No lecture scheduled for this period.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
