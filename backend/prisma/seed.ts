import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Clean old data
  await prisma.timetableSlot.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.room.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.department.deleteMany();

  // Create Departments
  const cse = await prisma.department.create({
    data: { id: 'CSE', name: 'Computer Science & Engineering' }
  });
  const ece = await prisma.department.create({
    data: { id: 'ECE', name: 'Electronics & Communication Engineering' }
  });
  const me = await prisma.department.create({
    data: { id: 'ME', name: 'Mechanical Engineering' }
  });

  console.log('Departments created.');

  // Password Hash for all users
  const hashedPassword = bcrypt.hashSync('password123', 10);

  // Helper to create Faculty and corresponding User Account
  const createFacultyUser = async (
    id: string,
    name: string,
    email: string,
    deptId: string,
    role: 'HOD' | 'FACULTY',
    maxWorkload = 18
  ) => {
    const faculty = await prisma.faculty.create({
      data: {
        id,
        name,
        email,
        departmentId: deptId,
        maxWorkload,
        availablePeriods: '[1,2,3,4,5,6]',
        preferredHours: '[1,2,3,4]',
        status: 'PRESENT'
      }
    });

    await prisma.user.create({
      data: {
        username: id.toLowerCase(),
        password: hashedPassword,
        role,
        facultyId: faculty.id
      }
    });

    return faculty;
  };

  // Create HODs
  const hodCse = await createFacultyUser('CSE_HOD', 'Dr. Amit Sharma', 'amit.cse@college.edu', 'CSE', 'HOD');
  const hodEce = await createFacultyUser('ECE_HOD', 'Dr. Priya Nair', 'priya.ece@college.edu', 'ECE', 'HOD');
  const hodMe = await createFacultyUser('ME_HOD', 'Dr. Rajesh Patel', 'rajesh.me@college.edu', 'ME', 'HOD');

  await prisma.department.update({ where: { id: 'CSE' }, data: { hodId: hodCse.id } });
  await prisma.department.update({ where: { id: 'ECE' }, data: { hodId: hodEce.id } });
  await prisma.department.update({ where: { id: 'ME' }, data: { hodId: hodMe.id } });

  // Create Admin User
  await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN'
    }
  });

  // Create CSE Faculty
  const fCse1 = await createFacultyUser('CSE_FAC1', 'Prof. John Doe', 'john.doe@college.edu', 'CSE', 'FACULTY');
  const fCse2 = await createFacultyUser('CSE_FAC2', 'Dr. Sarah Connor', 'sarah.c@college.edu', 'CSE', 'FACULTY');
  const fCse3 = await createFacultyUser('CSE_FAC3', 'Prof. Alan Turing', 'alan.t@college.edu', 'CSE', 'FACULTY');
  const fCse4 = await createFacultyUser('CSE_FAC4', 'Dr. Grace Hopper', 'grace.h@college.edu', 'CSE', 'FACULTY');
  const fCse5 = await createFacultyUser('CSE_FAC5', 'Prof. Ada Lovelace', 'ada.l@college.edu', 'CSE', 'FACULTY');

  // Create ECE Faculty
  const fEce1 = await createFacultyUser('ECE_FAC1', 'Dr. Nikola Tesla', 'nikola.t@college.edu', 'ECE', 'FACULTY');
  const fEce2 = await createFacultyUser('ECE_FAC2', 'Prof. Marie Curie', 'marie.c@college.edu', 'ECE', 'FACULTY');
  const fEce3 = await createFacultyUser('ECE_FAC3', 'Dr. Richard Feynman', 'richard.f@college.edu', 'ECE', 'FACULTY');
  const fEce4 = await createFacultyUser('ECE_FAC4', 'Prof. Albert Einstein', 'albert.e@college.edu', 'ECE', 'FACULTY');

  console.log('Faculties and User accounts created.');

  // Create Rooms & Labs
  const r101 = await prisma.room.create({ data: { id: 'CR101', name: 'Classroom 101', type: 'CLASSROOM', capacity: 60, departmentId: 'CSE' } });
  const r102 = await prisma.room.create({ data: { id: 'CR102', name: 'Classroom 102', type: 'CLASSROOM', capacity: 60, departmentId: 'CSE' } });
  const r201 = await prisma.room.create({ data: { id: 'CR201', name: 'Classroom 201', type: 'CLASSROOM', capacity: 60, departmentId: 'ECE' } });
  const r202 = await prisma.room.create({ data: { id: 'CR202', name: 'Classroom 202', type: 'CLASSROOM', capacity: 60, departmentId: 'ECE' } });

  const cseLab = await prisma.room.create({ data: { id: 'CSE_LAB', name: 'Advanced CSE Laboratory', type: 'LAB', capacity: 40, departmentId: 'CSE' } });
  const eceLab = await prisma.room.create({ data: { id: 'ECE_LAB', name: 'DSP & Microcontroller Lab', type: 'LAB', capacity: 40, departmentId: 'ECE' } });

  console.log('Classrooms and Laboratories created.');

  // Create Subjects (Predefined Primary, Secondary, Reserve)
  // CSE Subjects
  const ds = await prisma.subject.create({
    data: {
      id: 'CSE-DS',
      name: 'Data Structures & Algorithms',
      code: 'CS301',
      departmentId: 'CSE',
      primaryFacultyId: fCse1.id,
      secondaryFacultyId: fCse2.id,
      reserveFacultyId: fCse3.id,
      weeklyPeriods: 4
    }
  });

  const dbms = await prisma.subject.create({
    data: {
      id: 'CSE-DBMS',
      name: 'Database Management Systems',
      code: 'CS302',
      departmentId: 'CSE',
      primaryFacultyId: fCse2.id,
      secondaryFacultyId: fCse3.id,
      reserveFacultyId: fCse4.id,
      weeklyPeriods: 4
    }
  });

  const cn = await prisma.subject.create({
    data: {
      id: 'CSE-CN',
      name: 'Computer Networks',
      code: 'CS303',
      departmentId: 'CSE',
      primaryFacultyId: fCse3.id,
      secondaryFacultyId: fCse4.id,
      reserveFacultyId: fCse5.id,
      weeklyPeriods: 3
    }
  });

  const os = await prisma.subject.create({
    data: {
      id: 'CSE-OS',
      name: 'Operating Systems',
      code: 'CS304',
      departmentId: 'CSE',
      primaryFacultyId: fCse4.id,
      secondaryFacultyId: fCse5.id,
      reserveFacultyId: fCse1.id,
      weeklyPeriods: 3
    }
  });

  const toc = await prisma.subject.create({
    data: {
      id: 'CSE-TOC',
      name: 'Theory of Computation',
      code: 'CS305',
      departmentId: 'CSE',
      primaryFacultyId: fCse5.id,
      secondaryFacultyId: fCse1.id,
      reserveFacultyId: fCse2.id,
      weeklyPeriods: 3
    }
  });

  const dslab = await prisma.subject.create({
    data: {
      id: 'CSE-DSLAB',
      name: 'Data Structures Lab',
      code: 'CS301L',
      departmentId: 'CSE',
      primaryFacultyId: fCse1.id,
      secondaryFacultyId: fCse3.id,
      reserveFacultyId: fCse4.id,
      isLab: true,
      weeklyPeriods: 2
    }
  });

  // ECE Subjects
  const lic = await prisma.subject.create({
    data: {
      id: 'ECE-LIC',
      name: 'Linear Integrated Circuits',
      code: 'EC301',
      departmentId: 'ECE',
      primaryFacultyId: fEce1.id,
      secondaryFacultyId: fEce2.id,
      reserveFacultyId: fEce3.id,
      weeklyPeriods: 4
    }
  });

  const dc = await prisma.subject.create({
    data: {
      id: 'ECE-DC',
      name: 'Digital Communication',
      code: 'EC302',
      departmentId: 'ECE',
      primaryFacultyId: fEce2.id,
      secondaryFacultyId: fEce3.id,
      reserveFacultyId: fEce4.id,
      weeklyPeriods: 4
    }
  });

  const dsp = await prisma.subject.create({
    data: {
      id: 'ECE-DSP',
      name: 'Digital Signal Processing',
      code: 'EC303',
      departmentId: 'ECE',
      primaryFacultyId: fEce3.id,
      secondaryFacultyId: fEce4.id,
      reserveFacultyId: fEce1.id,
      weeklyPeriods: 4
    }
  });

  const dsplab = await prisma.subject.create({
    data: {
      id: 'ECE-DSPLAB',
      name: 'DSP Laboratory',
      code: 'EC303L',
      departmentId: 'ECE',
      primaryFacultyId: fEce3.id,
      secondaryFacultyId: fEce1.id,
      reserveFacultyId: fEce2.id,
      isLab: true,
      weeklyPeriods: 2
    }
  });

  console.log('Subjects created.');

  // Define Classes/Batches
  const classCse3A = 'CSE-3A';
  const classCse3B = 'CSE-3B';
  const classEce3A = 'ECE-3A';

  // Seed Timetable Slots
  // Helper to add slot and increment workload
  const addSlot = async (
    day: number,
    period: number,
    classId: string,
    deptId: string,
    subId: string,
    facId: string,
    roomId: string,
    isLab = false
  ) => {
    await prisma.timetableSlot.create({
      data: {
        day,
        period,
        classId,
        departmentId: deptId,
        subjectId: subId,
        facultyId: facId,
        roomId,
        isLab
      }
    });

    await prisma.faculty.update({
      where: { id: facId },
      data: { weeklyWorkload: { increment: 1 } }
    });
  };

  // --- CSE-3A Timetable ---
  // Monday
  await addSlot(1, 1, classCse3A, 'CSE', ds.id, fCse1.id, r101.id);
  await addSlot(1, 2, classCse3A, 'CSE', dbms.id, fCse2.id, r101.id);
  await addSlot(1, 3, classCse3A, 'CSE', cn.id, fCse3.id, r101.id);
  await addSlot(1, 4, classCse3A, 'CSE', os.id, fCse4.id, r101.id);
  
  // Tuesday
  await addSlot(2, 1, classCse3A, 'CSE', dbms.id, fCse2.id, r101.id);
  await addSlot(2, 2, classCse3A, 'CSE', toc.id, fCse5.id, r101.id);
  await addSlot(2, 3, classCse3A, 'CSE', dslab.id, fCse1.id, cseLab.id, true);
  await addSlot(2, 4, classCse3A, 'CSE', dslab.id, fCse1.id, cseLab.id, true);

  // Wednesday
  await addSlot(3, 1, classCse3A, 'CSE', ds.id, fCse1.id, r101.id);
  await addSlot(3, 2, classCse3A, 'CSE', os.id, fCse4.id, r101.id);
  await addSlot(3, 3, classCse3A, 'CSE', cn.id, fCse3.id, r101.id);
  await addSlot(3, 4, classCse3A, 'CSE', toc.id, fCse5.id, r101.id);

  // Thursday
  await addSlot(4, 1, classCse3A, 'CSE', dbms.id, fCse2.id, r101.id);
  await addSlot(4, 2, classCse3A, 'CSE', ds.id, fCse1.id, r101.id);
  await addSlot(4, 3, classCse3A, 'CSE', toc.id, fCse5.id, r101.id);
  await addSlot(4, 4, classCse3A, 'CSE', cn.id, fCse3.id, r101.id);

  // Friday
  await addSlot(5, 1, classCse3A, 'CSE', ds.id, fCse1.id, r101.id);
  await addSlot(5, 2, classCse3A, 'CSE', dbms.id, fCse2.id, r101.id);
  await addSlot(5, 3, classCse3A, 'CSE', os.id, fCse4.id, r101.id);

  // --- CSE-3B Timetable (Offset to prevent room & faculty double-booking) ---
  // Monday
  await addSlot(1, 1, classCse3B, 'CSE', dbms.id, fCse2.id, r102.id);
  await addSlot(1, 2, classCse3B, 'CSE', ds.id, fCse1.id, r102.id);
  await addSlot(1, 3, classCse3B, 'CSE', os.id, fCse4.id, r102.id);
  await addSlot(1, 4, classCse3B, 'CSE', toc.id, fCse5.id, r102.id);

  // Tuesday
  await addSlot(2, 1, classCse3B, 'CSE', ds.id, fCse1.id, r102.id);
  await addSlot(2, 2, classCse3B, 'CSE', dbms.id, fCse2.id, r102.id);
  await addSlot(2, 3, classCse3B, 'CSE', cn.id, fCse3.id, r102.id);
  await addSlot(2, 4, classCse3B, 'CSE', os.id, fCse4.id, r102.id);

  // Wednesday
  await addSlot(3, 1, classCse3B, 'CSE', dbms.id, fCse2.id, r102.id);
  await addSlot(3, 2, classCse3B, 'CSE', cn.id, fCse3.id, r102.id);
  await addSlot(3, 3, classCse3B, 'CSE', dslab.id, fCse1.id, cseLab.id, true);
  await addSlot(3, 4, classCse3B, 'CSE', dslab.id, fCse1.id, cseLab.id, true);

  // Thursday
  await addSlot(4, 1, classCse3B, 'CSE', os.id, fCse4.id, r102.id);
  await addSlot(4, 2, classCse3B, 'CSE', toc.id, fCse5.id, r102.id);
  await addSlot(4, 3, classCse3B, 'CSE', ds.id, fCse1.id, r102.id);

  // Friday
  await addSlot(5, 1, classCse3B, 'CSE', cn.id, fCse3.id, r102.id);
  await addSlot(5, 2, classCse3B, 'CSE', toc.id, fCse5.id, r102.id);
  await addSlot(5, 3, classCse3B, 'CSE', dbms.id, fCse2.id, r102.id);

  // --- ECE-3A Timetable ---
  // Monday
  await addSlot(1, 1, classEce3A, 'ECE', lic.id, fEce1.id, r201.id);
  await addSlot(1, 2, classEce3A, 'ECE', dc.id, fEce2.id, r201.id);
  await addSlot(1, 3, classEce3A, 'ECE', dsp.id, fEce3.id, r201.id);

  // Tuesday
  await addSlot(2, 1, classEce3A, 'ECE', dc.id, fEce2.id, r201.id);
  await addSlot(2, 2, classEce3A, 'ECE', lic.id, fEce1.id, r201.id);
  await addSlot(2, 3, classEce3A, 'ECE', dsplab.id, fEce3.id, eceLab.id, true);
  await addSlot(2, 4, classEce3A, 'ECE', dsplab.id, fEce3.id, eceLab.id, true);

  // Wednesday
  await addSlot(3, 1, classEce3A, 'ECE', dsp.id, fEce3.id, r201.id);
  await addSlot(3, 2, classEce3A, 'ECE', lic.id, fEce1.id, r201.id);
  await addSlot(3, 3, classEce3A, 'ECE', dc.id, fEce2.id, r201.id);

  // Thursday
  await addSlot(4, 1, classEce3A, 'ECE', lic.id, fEce1.id, r201.id);
  await addSlot(4, 2, classEce3A, 'ECE', dsp.id, fEce3.id, r201.id);
  await addSlot(4, 3, classEce3A, 'ECE', dc.id, fEce2.id, r201.id);

  // Friday
  await addSlot(5, 1, classEce3A, 'ECE', dsp.id, fEce3.id, r201.id);
  await addSlot(5, 2, classEce3A, 'ECE', dc.id, fEce2.id, r201.id);
  await addSlot(5, 3, classEce3A, 'ECE', lic.id, fEce1.id, r201.id);

  console.log('Timetable Slots successfully populated.');
  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
