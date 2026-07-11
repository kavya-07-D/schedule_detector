import { PrismaClient } from '@prisma/client';

// Helper to check if a faculty member is free (present and not double-booked)
export async function isFacultyFree(
  db: PrismaClient,
  facultyId: string,
  day: number,
  period: number,
  excludeSlotId?: string
): Promise<boolean> {
  const faculty = await db.faculty.findUnique({
    where: { id: facultyId }
  });
  
  if (!faculty || faculty.status !== 'PRESENT') {
    return false;
  }

  // Check if they are already teaching a class in this period
  const conflictingSlot = await db.timetableSlot.findFirst({
    where: {
      day,
      period,
      facultyId,
      id: excludeSlotId ? { not: excludeSlotId } : undefined
    }
  });

  return !conflictingSlot;
}

// Helper to check if a classroom or lab is free
export async function isRoomFree(
  db: PrismaClient,
  roomId: string,
  day: number,
  period: number,
  excludeSlotId?: string
): Promise<boolean> {
  const conflictingSlot = await db.timetableSlot.findFirst({
    where: {
      day,
      period,
      roomId,
      id: excludeSlotId ? { not: excludeSlotId } : undefined
    }
  });
  return !conflictingSlot;
}

export interface ScheduleChange {
  slotId: string;
  classId: string;
  day: number;
  period: number;
  originalFaculty: string;
  newFaculty: string;
  subjectCode: string;
  type: 'FALLBACK' | 'SWAP' | 'STUDY_HALL';
  reason: string;
}

/**
 * Resolves all timetable conflicts created by a faculty member's absence on a given day.
 * Implements fallback logic (Secondary -> Reserve) and falls back to slot swapping, 
 * rescheduling, and supervised study periods to ensure classes are never cancelled.
 */
export async function resolveFacultyAbsence(
  db: PrismaClient,
  absentFacultyId: string,
  day: number
): Promise<ScheduleChange[]> {
  const changes: ScheduleChange[] = [];
  
  // Retrieve all slots taught by the absent faculty on this day
  const slots = await db.timetableSlot.findMany({
    where: {
      facultyId: absentFacultyId,
      day
    },
    include: {
      subject: true,
      faculty: true,
      room: true
    }
  });

  for (const slot of slots) {
    const subject = slot.subject;
    const originalFacultyId = slot.originalFacultyId || absentFacultyId;

    // 1. Try Secondary Faculty
    if (await isFacultyFree(db, subject.secondaryFacultyId, day, slot.period)) {
      await db.timetableSlot.update({
        where: { id: slot.id },
        data: {
          facultyId: subject.secondaryFacultyId,
          originalFacultyId,
          isRescheduled: true,
          reason: `Reassigned to Secondary Faculty: ${subject.secondaryFacultyId}`
        }
      });

      // Update workloads
      await db.faculty.update({
        where: { id: absentFacultyId },
        data: { weeklyWorkload: { decrement: 1 } }
      });
      await db.faculty.update({
        where: { id: subject.secondaryFacultyId },
        data: { weeklyWorkload: { increment: 1 } }
      });

      changes.push({
        slotId: slot.id,
        classId: slot.classId,
        day,
        period: slot.period,
        originalFaculty: absentFacultyId,
        newFaculty: subject.secondaryFacultyId,
        subjectCode: subject.code,
        type: 'FALLBACK',
        reason: `Secondary Faculty (${subject.secondaryFacultyId}) substituted.`
      });
      continue;
    }

    // 2. Try Reserve Faculty
    if (await isFacultyFree(db, subject.reserveFacultyId, day, slot.period)) {
      await db.timetableSlot.update({
        where: { id: slot.id },
        data: {
          facultyId: subject.reserveFacultyId,
          originalFacultyId,
          isRescheduled: true,
          reason: `Reassigned to Reserve Faculty: ${subject.reserveFacultyId}`
        }
      });

      // Update workloads
      await db.faculty.update({
        where: { id: absentFacultyId },
        data: { weeklyWorkload: { decrement: 1 } }
      });
      await db.faculty.update({
        where: { id: subject.reserveFacultyId },
        data: { weeklyWorkload: { increment: 1 } }
      });

      changes.push({
        slotId: slot.id,
        classId: slot.classId,
        day,
        period: slot.period,
        originalFaculty: absentFacultyId,
        newFaculty: subject.reserveFacultyId,
        subjectCode: subject.code,
        type: 'FALLBACK',
        reason: `Reserve Faculty (${subject.reserveFacultyId}) substituted.`
      });
      continue;
    }

    // 3. Swap Slots Algorithm
    // Search other slots of the same class (on the same day first, then other days)
    const possibleSwapSlots = await db.timetableSlot.findMany({
      where: {
        classId: slot.classId,
        id: { not: slot.id }
      },
      include: {
        subject: true,
        faculty: true,
        room: true
      }
    });

    // Prioritize slots on the same day to minimize weekly disruptions
    possibleSwapSlots.sort((a, b) => {
      if (a.day === day && b.day !== day) return -1;
      if (a.day !== day && b.day === day) return 1;
      return a.period - b.period;
    });

    let swapFound = false;
    for (const targetSlot of possibleSwapSlots) {
      const targetFacultyId = targetSlot.facultyId;
      
      // Can the target faculty teach their subject at our slot's period?
      const targetFacultyIsFree = await isFacultyFree(db, targetFacultyId, day, slot.period, slot.id);
      if (!targetFacultyIsFree) continue;

      // Is there a fallback faculty (secondary/reserve) free to teach our subject at targetSlot's period?
      let chosenFallbackId = '';
      if (await isFacultyFree(db, subject.secondaryFacultyId, targetSlot.day, targetSlot.period, targetSlot.id)) {
        chosenFallbackId = subject.secondaryFacultyId;
      } else if (await isFacultyFree(db, subject.reserveFacultyId, targetSlot.day, targetSlot.period, targetSlot.id)) {
        chosenFallbackId = subject.reserveFacultyId;
      }

      if (!chosenFallbackId) continue;

      // Are the rooms available for the swap?
      const targetRoomIsFree = await isRoomFree(db, targetSlot.roomId, day, slot.period, slot.id);
      const ourRoomIsFree = await isRoomFree(db, slot.roomId, targetSlot.day, targetSlot.period, targetSlot.id);
      if (!targetRoomIsFree || !ourRoomIsFree) continue;

      // Swap is valid! Apply transaction
      await db.$transaction([
        db.timetableSlot.update({
          where: { id: slot.id },
          data: {
            subjectId: targetSlot.subjectId,
            facultyId: targetSlot.facultyId,
            roomId: targetSlot.roomId,
            isLab: targetSlot.isLab,
            isRescheduled: true,
            reason: `Swapped with Day ${targetSlot.day} Period ${targetSlot.period} due to Faculty Absence`
          }
        }),
        db.timetableSlot.update({
          where: { id: targetSlot.id },
          data: {
            subjectId: slot.subjectId,
            facultyId: chosenFallbackId,
            originalFacultyId,
            roomId: slot.roomId,
            isLab: slot.isLab,
            isRescheduled: true,
            reason: `Swapped with Day ${slot.day} Period ${slot.period} due to Faculty Absence`
          }
        })
      ]);

      // Adjust workloads
      await db.faculty.update({
        where: { id: absentFacultyId },
        data: { weeklyWorkload: { decrement: 1 } }
      });
      await db.faculty.update({
        where: { id: chosenFallbackId },
        data: { weeklyWorkload: { increment: 1 } }
      });

      changes.push({
        slotId: slot.id,
        classId: slot.classId,
        day,
        period: slot.period,
        originalFaculty: absentFacultyId,
        newFaculty: chosenFallbackId,
        subjectCode: subject.code,
        type: 'SWAP',
        reason: `Swapped with Day ${targetSlot.day} Period ${targetSlot.period}. Fallback ${chosenFallbackId} assigned.`
      });

      swapFound = true;
      break;
    }

    if (swapFound) continue;

    // 4. Fallback to Supervised Study Hall
    // Look for any free faculty member from the same department first, then college-wide
    const deptFaculties = await db.faculty.findMany({
      where: {
        departmentId: slot.faculty.departmentId,
        status: 'PRESENT',
        id: { not: absentFacultyId }
      }
    });

    let supervisorId = '';
    for (const f of deptFaculties) {
      if (await isFacultyFree(db, f.id, day, slot.period)) {
        supervisorId = f.id;
        break;
      }
    }

    if (!supervisorId) {
      const allFaculties = await db.faculty.findMany({
        where: {
          status: 'PRESENT',
          id: { not: absentFacultyId }
        }
      });
      for (const f of allFaculties) {
        if (await isFacultyFree(db, f.id, day, slot.period)) {
          supervisorId = f.id;
          break;
        }
      }
    }

    if (supervisorId) {
      await db.timetableSlot.update({
        where: { id: slot.id },
        data: {
          facultyId: supervisorId,
          originalFacultyId,
          isRescheduled: true,
          reason: `Supervised Study Hall under ${supervisorId} (Primary Absent)`
        }
      });

      await db.faculty.update({
        where: { id: absentFacultyId },
        data: { weeklyWorkload: { decrement: 1 } }
      });
      await db.faculty.update({
        where: { id: supervisorId },
        data: { weeklyWorkload: { increment: 1 } }
      });

      changes.push({
        slotId: slot.id,
        classId: slot.classId,
        day,
        period: slot.period,
        originalFaculty: absentFacultyId,
        newFaculty: supervisorId,
        subjectCode: subject.code,
        type: 'STUDY_HALL',
        reason: `Supervised Study Hall under ${supervisorId}.`
      });
    } else {
      // 5. Absolute Emergency Fallback: Reassign to Department HOD or Admin for supervision
      const hod = await db.faculty.findFirst({
        where: {
          departmentId: slot.faculty.departmentId,
          user: { role: 'HOD' },
          status: 'PRESENT'
        }
      });

      const fallbackSupervisor = hod ? hod.id : 'ADMIN';

      await db.timetableSlot.update({
        where: { id: slot.id },
        data: {
          facultyId: fallbackSupervisor,
          originalFacultyId,
          isRescheduled: true,
          reason: `Emergency Supervision - HOD/Admin`
        }
      });

      await db.faculty.update({
        where: { id: absentFacultyId },
        data: { weeklyWorkload: { decrement: 1 } }
      });

      changes.push({
        slotId: slot.id,
        classId: slot.classId,
        day,
        period: slot.period,
        originalFaculty: absentFacultyId,
        newFaculty: fallbackSupervisor,
        subjectCode: subject.code,
        type: 'STUDY_HALL',
        reason: `Emergency Supervision by HOD/Admin.`
      });
    }
  }

  return changes;
}

/**
 * Reset all rescheduled changes for a faculty member when they return.
 */
export async function revertFacultyAbsence(
  db: PrismaClient,
  facultyId: string
): Promise<void> {
  const rescheduledSlots = await db.timetableSlot.findMany({
    where: {
      originalFacultyId: facultyId,
      isRescheduled: true
    }
  });

  for (const slot of rescheduledSlots) {
    const currentFacultyId = slot.facultyId;
    
    // Reset slot back to original faculty
    await db.timetableSlot.update({
      where: { id: slot.id },
      data: {
        facultyId: facultyId,
        originalFacultyId: null,
        isRescheduled: false,
        reason: null
      }
    });

    // Restore workloads
    await db.faculty.update({
      where: { id: facultyId },
      data: { weeklyWorkload: { increment: 1 } }
    });
    
    await db.faculty.update({
      where: { id: currentFacultyId },
      data: { weeklyWorkload: { decrement: 1 } }
    });
  }
}
