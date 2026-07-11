import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolveFacultyAbsence, revertFacultyAbsence, isFacultyFree, isRoomFree } from './scheduler';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

app.use(cors());
app.use(express.json());

// Middleware for authentication
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Middleware for roles
const authorize = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
    }
    next();
  };
};

// --- AUTHENTICATION ENDPOINTS ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { faculty: true }
    });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, facultyId: user.facultyId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        facultyId: user.facultyId,
        name: user.faculty?.name || 'Administrator'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- FACULTY ENDPOINTS ---
app.get('/api/faculty', authenticate, async (req, res) => {
  try {
    const faculties = await prisma.faculty.findMany({
      include: { department: true }
    });
    res.json(faculties);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update faculty status (Present / Absent)
app.post('/api/faculty/:id/status', authenticate, authorize(['ADMIN', 'HOD']), async (req, res) => {
  const { id } = req.params;
  const { status, day } = req.body; // Day is optional, default to Monday/Today
  
  const targetDay = day || 1; // 1 = Monday, etc.

  try {
    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

    const oldStatus = faculty.status;
    const updatedFaculty = await prisma.faculty.update({
      where: { id },
      data: { status }
    });

    let changes: any[] = [];
    if (status === 'ABSENT' || status === 'LEAVE') {
      // Trigger AI Scheduler
      changes = await resolveFacultyAbsence(prisma, id, targetDay);
      
      // Notify affected users
      const notificationMessage = `Faculty ${faculty.name} marked ${status.toLowerCase()}. Timetable optimized. ${changes.length} class(es) rescheduled.`;
      await prisma.notification.create({
        data: {
          message: notificationMessage,
          type: 'ALERT',
          role: 'ALL'
        }
      });
      io.emit('notification', { message: notificationMessage, type: 'ALERT' });
      io.emit('timetable_updated');
    } else if (status === 'PRESENT' && (oldStatus === 'ABSENT' || oldStatus === 'LEAVE')) {
      // Revert changes back to this faculty
      await revertFacultyAbsence(prisma, id);
      const notificationMessage = `Faculty ${faculty.name} is now present. Timetable reverted to original.`;
      await prisma.notification.create({
        data: {
          message: notificationMessage,
          type: 'SUCCESS',
          role: 'ALL'
        }
      });
      io.emit('notification', { message: notificationMessage, type: 'SUCCESS' });
      io.emit('timetable_updated');
    }

    res.json({ faculty: updatedFaculty, rescheduledChanges: changes });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- TIMETABLE ENDPOINTS ---
app.get('/api/timetable', authenticate, async (req, res) => {
  const { classId, facultyId, roomId, departmentId } = req.query;
  try {
    const slots = await prisma.timetableSlot.findMany({
      where: {
        classId: classId ? String(classId) : undefined,
        facultyId: facultyId ? String(facultyId) : undefined,
        roomId: roomId ? String(roomId) : undefined,
        departmentId: departmentId ? String(departmentId) : undefined
      },
      include: {
        subject: true,
        faculty: true,
        originalFaculty: true,
        room: true
      }
    });
    res.json(slots);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Timetable Reschedule (Drag & Drop UI Support)
app.post('/api/timetable/reschedule', authenticate, authorize(['ADMIN', 'HOD']), async (req, res) => {
  const { slotId, targetDay, targetPeriod, targetRoomId } = req.body;

  try {
    const slot = await prisma.timetableSlot.findUnique({
      where: { id: slotId },
      include: { subject: true }
    });
    if (!slot) return res.status(404).json({ error: 'Timetable slot not found' });

    // Validate double-booking constraints
    const facultyFree = await isFacultyFree(prisma, slot.facultyId, targetDay, targetPeriod, slotId);
    if (!facultyFree) {
      return res.status(400).json({ error: 'Conflict: Faculty is busy during this period.' });
    }

    const roomFree = await isRoomFree(prisma, targetRoomId || slot.roomId, targetDay, targetPeriod, slotId);
    if (!roomFree) {
      return res.status(400).json({ error: 'Conflict: Classroom/Lab is occupied during this period.' });
    }

    const classConflictingSlot = await prisma.timetableSlot.findFirst({
      where: {
        day: targetDay,
        period: targetPeriod,
        classId: slot.classId,
        id: { not: slotId }
      }
    });
    if (classConflictingSlot) {
      return res.status(400).json({ error: 'Conflict: This class already has another lecture scheduled in this period.' });
    }

    // Apply manual adjustment
    const updatedSlot = await prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        day: targetDay,
        period: targetPeriod,
        roomId: targetRoomId || slot.roomId,
        isRescheduled: true,
        reason: 'Manual adjustment by administrator'
      }
    });

    const msg = `Timetable slot for ${slot.classId} (${slot.subject.name}) manually moved to Day ${targetDay} Period ${targetPeriod}.`;
    await prisma.notification.create({
      data: { message: msg, type: 'INFO', role: 'ALL' }
    });
    io.emit('notification', { message: msg, type: 'INFO' });
    io.emit('timetable_updated');

    res.json(updatedSlot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Force timetable regeneration (Resets and resolves all active absences for a department)
app.post('/api/timetable/regenerate', authenticate, authorize(['ADMIN', 'HOD']), async (req, res) => {
  const { departmentId, day } = req.body;
  const targetDay = day || 1;

  try {
    // 1. Reset all rescheduled slots for the day in this department
    const rescheduled = await prisma.timetableSlot.findMany({
      where: {
        departmentId,
        day: targetDay,
        isRescheduled: true
      }
    });

    for (const slot of rescheduled) {
      if (slot.originalFacultyId) {
        // Revert workload count
        await prisma.faculty.update({
          where: { id: slot.originalFacultyId },
          data: { weeklyWorkload: { increment: 1 } }
        });
        await prisma.faculty.update({
          where: { id: slot.facultyId },
          data: { weeklyWorkload: { decrement: 1 } }
        });

        await prisma.timetableSlot.update({
          where: { id: slot.id },
          data: {
            facultyId: slot.originalFacultyId,
            originalFacultyId: null,
            isRescheduled: false,
            reason: null
          }
        });
      }
    }

    // 2. Fetch all absent/leave faculties in the department
    const absentFaculties = await prisma.faculty.findMany({
      where: {
        departmentId,
        status: { in: ['ABSENT', 'LEAVE'] }
      }
    });

    let totalChanges = 0;
    for (const faculty of absentFaculties) {
      const changes = await resolveFacultyAbsence(prisma, faculty.id, targetDay);
      totalChanges += changes.length;
    }

    const msg = `Timetable regenerated for ${departmentId} (Day ${targetDay}). Optimized ${totalChanges} slots.`;
    await prisma.notification.create({
      data: { message: msg, type: 'SUCCESS', role: 'ALL' }
    });
    io.emit('notification', { message: msg, type: 'SUCCESS' });
    io.emit('timetable_updated');

    res.json({ message: 'Timetable regenerated successfully', optimizedCount: totalChanges });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- LEAVE ENDPOINTS ---
app.get('/api/leave', authenticate, async (req, res) => {
  try {
    let leaves;
    if ((req as any).user.role === 'FACULTY') {
      leaves = await prisma.leaveRequest.findMany({
        where: { facultyId: (req as any).user.facultyId },
        include: { faculty: true }
      });
    } else {
      leaves = await prisma.leaveRequest.findMany({
        include: { faculty: true }
      });
    }
    res.json(leaves);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave', authenticate, async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  const facultyId = (req as any).user.facultyId;

  if (!facultyId) return res.status(400).json({ error: 'Administrator accounts cannot apply for leave.' });

  try {
    const leave = await prisma.leaveRequest.create({
      data: {
        facultyId,
        startDate,
        endDate,
        reason,
        status: 'PENDING'
      },
      include: { faculty: true }
    });

    const msg = `Leave request submitted by ${leave.faculty.name}. Pending HOD approval.`;
    await prisma.notification.create({
      data: { message: msg, type: 'INFO', role: 'HOD' }
    });
    io.emit('notification', { message: msg, type: 'INFO' });

    res.json(leave);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave/:id/approve', authenticate, authorize(['ADMIN', 'HOD']), async (req, res) => {
  const { id } = req.params;
  const { status, statusMessage } = req.body; // status: "APPROVED" or "REJECTED"

  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { faculty: true }
    });
    if (!leave) return res.status(404).json({ error: 'Leave request not found' });

    const updatedLeave = await prisma.leaveRequest.update({
      where: { id },
      data: { status, statusMessage }
    });

    if (status === 'APPROVED') {
      // Mark faculty status as LEAVE
      await prisma.faculty.update({
        where: { id: leave.facultyId },
        data: { status: 'LEAVE' }
      });

      // Optimize timetable for Monday (Day 1) as a demo default
      const changes = await resolveFacultyAbsence(prisma, leave.facultyId, 1);

      const msg = `Leave approved for ${leave.faculty.name}. Timetable automatically optimized (${changes.length} slots rescheduled).`;
      await prisma.notification.create({
        data: { message: msg, type: 'SUCCESS', role: 'ALL' }
      });
      io.emit('notification', { message: msg, type: 'SUCCESS' });
      io.emit('timetable_updated');
    } else {
      const msg = `Leave request for ${leave.faculty.name} was rejected.`;
      await prisma.notification.create({
        data: { message: msg, type: 'INFO', role: leave.facultyId }
      });
      io.emit('notification', { message: msg, type: 'INFO' });
    }

    res.json(updatedLeave);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN / METRICS & ANALYTICS ENDPOINTS ---
app.get('/api/analytics', authenticate, async (req, res) => {
  try {
    const totalFaculty = await prisma.faculty.count();
    const presentFaculty = await prisma.faculty.count({ where: { status: 'PRESENT' } });
    const absentFaculty = await prisma.faculty.count({ where: { status: { in: ['ABSENT', 'LEAVE'] } } });
    
    // Today's slot statistics (Day 1 = Monday as representation)
    const todayClasses = await prisma.timetableSlot.count({ where: { day: 1 } });
    const rescheduledClasses = await prisma.timetableSlot.count({
      where: { day: 1, isRescheduled: true }
    });

    const pendingLeaves = await prisma.leaveRequest.count({ where: { status: 'PENDING' } });

    // Classroom & Lab Utilizations
    const totalRooms = await prisma.room.count({ where: { type: 'CLASSROOM' } });
    const activeRooms = await prisma.timetableSlot.findMany({
      where: { day: 1, isLab: false },
      select: { roomId: true },
      distinct: ['roomId']
    });
    const classroomUtilization = totalRooms > 0 ? Math.round((activeRooms.length / totalRooms) * 100) : 0;

    const totalLabs = await prisma.room.count({ where: { type: 'LAB' } });
    const activeLabs = await prisma.timetableSlot.findMany({
      where: { day: 1, isLab: true },
      select: { roomId: true },
      distinct: ['roomId']
    });
    const labUtilization = totalLabs > 0 ? Math.round((activeLabs.length / totalLabs) * 100) : 0;

    // Faculty workloads for chart
    const faculties = await prisma.faculty.findMany({
      select: { id: true, name: true, weeklyWorkload: true, maxWorkload: true }
    });

    // Department workloads
    const departments = await prisma.department.findMany({
      include: {
        faculties: {
          select: { weeklyWorkload: true }
        }
      }
    });

    const deptWorkloads = departments.map((d) => {
      const total = d.faculties.reduce((sum, f) => sum + f.weeklyWorkload, 0);
      return {
        name: d.id,
        workload: total
      };
    });

    // Quick notifications list
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      metrics: {
        totalFaculty,
        presentFaculty,
        absentFaculty,
        todayClasses,
        rescheduledClasses,
        pendingLeaves,
        classroomUtilization,
        labUtilization
      },
      charts: {
        facultyWorkloads: faculties,
        departmentWorkloads: deptWorkloads,
        attendanceTrends: [
          { name: 'Mon', Present: 12, Absent: 0 },
          { name: 'Tue', Present: 11, Absent: 1 },
          { name: 'Wed', Present: 12, Absent: 0 },
          { name: 'Thu', Present: 10, Absent: 2 },
          { name: 'Fri', Present: 9, Absent: 3 }
        ]
      },
      notifications
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications API
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const list = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- REAL-TIME CHAT / SOCKET LOGIC ---
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
