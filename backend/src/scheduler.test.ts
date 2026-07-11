import { PrismaClient } from '@prisma/client';
import { resolveFacultyAbsence, revertFacultyAbsence } from './scheduler';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING TIMETABLE SCHEDULER UNIT TESTS ---');

  try {
    // Reset status to PRESENT for all faculties before starting test
    await prisma.faculty.updateMany({
      data: { status: 'PRESENT', weeklyWorkload: 4 }
    });

    // Reset all slots to original state
    const slots = await prisma.timetableSlot.findMany();
    for (const slot of slots) {
      await prisma.timetableSlot.update({
        where: { id: slot.id },
        data: {
          facultyId: slot.originalFacultyId || slot.facultyId,
          originalFacultyId: null,
          isRescheduled: false,
          reason: null
        }
      });
    }

    console.log('Database reset completed. Starting test scenarios...');

    // Test Case 1: Primary Faculty Absence -> Bypasses busy Secondary -> Assigns Reserve
    console.log('\n[TEST 1] Testing Primary Faculty Absence (CSE_FAC1)...');
    // fCse1 (John Doe) teaches Data Structures CSE-DS at Day 1 Period 1.
    // Secondary is fCse2, who is busy teaching DBMS to CSE-3B.
    // Reserve is fCse3, who is free.
    // Mark fCse1 absent
    await prisma.faculty.update({
      where: { id: 'CSE_FAC1' },
      data: { status: 'ABSENT' }
    });

    const changes1 = await resolveFacultyAbsence(prisma, 'CSE_FAC1', 1);
    console.log(`AI Optimizer output ${changes1.length} changes:`);
    console.log(changes1);

    // Verify DS slot was moved to CSE_FAC3 (Alan Turing) because CSE_FAC2 was busy
    const slotAfter1 = await prisma.timetableSlot.findFirst({
      where: { classId: 'CSE-3A', day: 1, period: 1 }
    });

    if (slotAfter1?.facultyId === 'CSE_FAC3' && slotAfter1.isRescheduled) {
      console.log('✓ TEST 1 PASSED: Successfully bypassed busy Secondary and assigned free Reserve Faculty (CSE_FAC3).');
    } else {
      console.error(`✗ TEST 1 FAILED: Incorrect slot reassignment: ${slotAfter1?.facultyId}`);
      process.exit(1);
    }

    // Test Case 2: All fallbacks unavailable -> Triggers study hall supervision
    console.log('\n[TEST 2] Testing when all fallbacks are unavailable...');
    
    // Revert Test 1
    await revertFacultyAbsence(prisma, 'CSE_FAC1');
    await prisma.faculty.update({
      where: { id: 'CSE_FAC1' },
      data: { status: 'ABSENT' }
    });
    // Mark Secondary (CSE_FAC2) absent as well
    await prisma.faculty.update({
      where: { id: 'CSE_FAC2' },
      data: { status: 'ABSENT' }
    });
    // Mark Reserve (CSE_FAC3) absent as well
    await prisma.faculty.update({
      where: { id: 'CSE_FAC3' },
      data: { status: 'ABSENT' }
    });

    const changes2 = await resolveFacultyAbsence(prisma, 'CSE_FAC1', 1);
    console.log(changes2);

    // Since all three are absent, it should assign a free supervisor (e.g. CSE_FAC4 or HOD)
    const slotAfter2 = await prisma.timetableSlot.findFirst({
      where: { classId: 'CSE-3A', day: 1, period: 1 }
    });

    if (slotAfter2?.facultyId !== 'CSE_FAC1' && slotAfter2?.isRescheduled && slotAfter2?.reason?.includes('Supervised Study Hall')) {
      console.log(`✓ TEST 2 PASSED: Bypassed all absent/busy teachers and assigned Supervised Study Hall under (${slotAfter2.facultyId}).`);
    } else {
      console.error(`✗ TEST 2 FAILED: Incorrect slot handling: ${slotAfter2?.facultyId} (${slotAfter2?.reason})`);
      process.exit(1);
    }

    // Test Case 3: Revert Changes
    console.log('\n[TEST 3] Testing Reversion of absence when faculty returns...');
    await prisma.faculty.update({
      where: { id: 'CSE_FAC1' },
      data: { status: 'PRESENT' }
    });
    await revertFacultyAbsence(prisma, 'CSE_FAC1');

    const slotAfter3 = await prisma.timetableSlot.findFirst({
      where: { classId: 'CSE-3A', day: 1, period: 1 }
    });

    if (slotAfter3?.facultyId === 'CSE_FAC1' && !slotAfter3.isRescheduled) {
      console.log('✓ TEST 3 PASSED: Successfully reverted slot back to Primary Faculty.');
    } else {
      console.error('✗ TEST 3 FAILED: Reversion failed.');
      process.exit(1);
    }

    console.log('\n--- ALL ALGORITHMIC SCHEDULER TESTS PASSED ---');
    process.exit(0);

  } catch (error) {
    console.error('Error executing tests:', error);
    process.exit(1);
  }
}

runTests();
