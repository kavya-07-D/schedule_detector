import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { useSocket } from '../context/SocketContext';
import { Calendar, User, FileText, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

interface LeaveRequest {
  id: string;
  facultyId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  statusMessage: string | null;
  createdAt: string;
  faculty: { name: string; departmentId: string };
}

export const LeavePanel: React.FC = () => {
  const { token, user } = useAuth();
  const { socket, addToast } = useSocket();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leave`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaves(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();

    if (socket) {
      socket.on('notification', fetchLeaves);
    }
    return () => {
      if (socket) socket.off('notification', fetchLeaves);
    };
  }, [token, socket]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      addToast('Please fill all leave fields', 'ALERT');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ startDate, endDate, reason })
      });

      const data = await res.json();
      if (res.ok) {
        addToast('Leave request submitted successfully!', 'SUCCESS');
        setStartDate('');
        setEndDate('');
        setReason('');
        fetchLeaves();
      } else {
        addToast(data.error || 'Failed to submit leave', 'ALERT');
      }
    } catch (err) {
      console.error(err);
      addToast('Error while submitting leave request', 'ALERT');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveLeave = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    try {
      const statusMessage = status === 'APPROVED' ? 'Approved by HOD' : 'Rejected by HOD';
      const res = await fetch(`${API_URL}/api/leave/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, statusMessage })
      });

      const data = await res.json();
      if (res.ok) {
        addToast(`Leave request ${status.toLowerCase()} successfully!`, 'SUCCESS');
        fetchLeaves();
      } else {
        addToast(data.error || 'Failed to process leave', 'ALERT');
      }
    } catch (e) {
      console.error(e);
      addToast('Error processing leave request', 'ALERT');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      {/* Leave Application Form (Faculty Only) */}
      {user?.role === 'FACULTY' && (
        <div className="bg-card border p-6 rounded-2xl shadow-sm h-fit">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-indigo-500" /> Apply for Leave
          </h3>
          <form onSubmit={handleSubmitLeave} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-background border px-3 py-2 text-sm rounded-xl outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-background border px-3 py-2 text-sm rounded-xl outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason for Leave</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State reason (e.g., Medical Emergency, Conference Presentation)..."
                rows={4}
                className="w-full bg-background border px-3 py-2 text-sm rounded-xl outline-none resize-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl transition-all shadow-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>
      )}

      {/* Leave Requests Log List */}
      <div className={`bg-card border p-6 rounded-2xl shadow-sm lg:col-span-2 ${user?.role !== 'FACULTY' ? 'lg:col-span-3' : ''}`}>
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-indigo-500" /> Leave Requests Ledger
        </h3>

        {loading && leaves.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="h-10 w-10 stroke-[1.5] mb-2" />
            <p className="text-sm">No leave requests recorded.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {leaves.map((leave) => (
              <div 
                key={leave.id} 
                className={`p-4 border rounded-2xl transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 ${
                  leave.status === 'APPROVED' ? 'border-emerald-500/20' : 
                  leave.status === 'REJECTED' ? 'border-rose-500/20' : 
                  'border-border hover:border-indigo-500/30'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{leave.faculty.name}</span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold text-muted-foreground">
                      {leave.faculty.departmentId}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {leave.startDate} to {leave.endDate}</span>
                  </div>

                  <p className="text-xs text-foreground bg-card border px-3 py-2 rounded-xl mt-1.5 leading-relaxed italic">
                    "{leave.reason}"
                  </p>

                  {leave.statusMessage && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Note: <span className="font-bold">{leave.statusMessage}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-row md:flex-col items-end gap-2 shrink-0">
                  {leave.status === 'PENDING' ? (
                    (user?.role === 'ADMIN' || user?.role === 'HOD') ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveLeave(leave.id, 'APPROVED')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg transition-all"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleApproveLeave(leave.id, 'REJECTED')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-lg transition-all"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Pending Review
                      </span>
                    )
                  ) : leave.status === 'APPROVED' ? (
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Leave Approved
                    </span>
                  ) : (
                    <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1 border border-rose-500/20">
                      <XCircle className="h-3.5 w-3.5" /> Leave Rejected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
