import { PrismaClient, OperatingRule, LeaveType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding master data...");

  // 1. Processes
  const processDefs = [
    { code: "CS", name: "Customer Support" },
    { code: "ACC", name: "Abandoned Cart Conversion" },
    { code: "NDR", name: "Non-Delivery Report" },
    { code: "RET", name: "Retention" },
  ];

  const processes: Record<string, string> = {};
  for (const p of processDefs) {
    const record = await prisma.process.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: { code: p.code, name: p.name },
    });
    processes[p.code] = record.id;
  }
  console.log("Processes seeded:", Object.keys(processes).length);

  // 2. Pods & Employees (4 pods, 32 employees, 8 each, lead is one of them)
  const podConfigs = [
    {
      name: "Falcon Pod",
      leadName: "Aarav Sharma",
      members: [
        "Aarav Sharma",
        "Priya Patel",
        "Rohan Mehta",
        "Ananya Iyer",
        "Vikram Singh",
        "Sneha Rao",
        "Aditya Verma",
        "Pooja Nair",
      ],
    },
    {
      name: "Titan Pod",
      leadName: "Rahul Gupta",
      members: [
        "Rahul Gupta",
        "Neha Joshi",
        "Arjun Reddy",
        "Divya Kapoor",
        "Siddharth Sen",
        "Kavita Das",
        "Varun Nair",
        "Meera Pillai",
      ],
    },
    {
      name: "Zenith Pod",
      leadName: "Karan Malhotra",
      members: [
        "Karan Malhotra",
        "Ritu Desai",
        "Aman Saxena",
        "Swati Bhatt",
        "Nikhil Kulkarni",
        "Shreya Mishra",
        "Kunal Chopra",
        "Tanvi Jain",
      ],
    },
    {
      name: "Vanguard Pod",
      leadName: "Harish Kumar",
      members: [
        "Harish Kumar",
        "Deepa Choudhury",
        "Gaurav Chawla",
        "Pallavi Bose",
        "Manish Tiwari",
        "Sunita Menon",
        "Tarun Pandey",
        "Jyoti Aggarwal",
      ],
    },
  ];

  const employeeList: { id: string; name: string }[] = [];

  for (const podCfg of podConfigs) {
    const pod = await prisma.pod.upsert({
      where: { name: podCfg.name },
      update: {},
      create: { name: podCfg.name },
    });

    let leadId: string | null = null;

    for (const memberName of podCfg.members) {
      const email = `${memberName.toLowerCase().replace(/\s+/g, ".")}@datastraw.internal`;
      const emp = await prisma.employee.upsert({
        where: { email },
        update: { name: memberName, podId: pod.id, isActive: true },
        create: {
          name: memberName,
          email,
          podId: pod.id,
          isActive: true,
        },
      });

      employeeList.push({ id: emp.id, name: emp.name });

      if (memberName === podCfg.leadName) {
        leadId = emp.id;
      }
    }

    if (leadId) {
      await prisma.pod.update({
        where: { id: pod.id },
        data: { leadId },
      });
    }
  }
  console.log("Pods and Employees seeded:", employeeList.length);

  // Set preferredOffDay for ~10 employees
  const preferredOffDays = [0, 0, 6, 1, 5, 0, 6, 3, 0, 6];
  for (let i = 0; i < 10; i++) {
    await prisma.employee.update({
      where: { id: employeeList[i].id },
      data: { preferredOffDay: preferredOffDays[i] },
    });
  }
  console.log("preferredOffDay set for 10 employees");

  // 3. Brands & Brand Processes
  interface BrandSeedDef {
    name: string;
    processes: { code: string; rule?: OperatingRule; minCoverage?: number }[];
  }

  const brandDefs: BrandSeedDef[] = [
    // 5 Multi-resource
    {
      name: "Kalyan Organics",
      processes: [
        { code: "CS", rule: OperatingRule.ALL_365, minCoverage: 1 },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS, minCoverage: 1 },
        { code: "NDR", rule: OperatingRule.NO_SUN_HOLIDAYS, minCoverage: 1 },
      ],
    },
    {
      name: "Zouk Lifestyle",
      processes: [
        { code: "CS", rule: OperatingRule.ALL_365, minCoverage: 2 },
        { code: "RET", rule: OperatingRule.EXCEPT_HOLIDAYS, minCoverage: 1 },
      ],
    },
    {
      name: "Paperboat Foods",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS, minCoverage: 1 },
        { code: "NDR", rule: OperatingRule.EXCEPT_HOLIDAYS, minCoverage: 1 },
      ],
    },
    {
      name: "Wakefit Sleep",
      processes: [
        { code: "ACC", rule: OperatingRule.ALL_365, minCoverage: 2 },
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS, minCoverage: 1 },
      ],
    },
    {
      name: "Sugar Cosmetics",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS, minCoverage: 1 },
        { code: "RET", rule: OperatingRule.EXCEPT_HOLIDAYS, minCoverage: 1 },
      ],
    },
    // 19 Single-resource
    {
      name: "Blue Tokai Coffee",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.NO_SUN_HOLIDAYS },
      ],
    },
    {
      name: "Chaayos Express",
      processes: [{ code: "CS", rule: OperatingRule.ALL_365 }],
    },
    {
      name: "Boat Audio",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "RET", rule: OperatingRule.NO_SUN_HOLIDAYS },
      ],
    },
    {
      name: "Lenskart Direct",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "NDR", rule: OperatingRule.NO_SUN_HOLIDAYS },
      ],
    },
    {
      name: "Mamaearth Naturals",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Epigamia Dairy",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "NDR", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Sleepy Owl Brews",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Phool Incense",
      processes: [{ code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS }],
    },
    {
      name: "Country Delight",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "NDR", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "RET", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Mokobara Travel",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Bombay Shaving Co",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "RET", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Snitch Fashion",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Suta Artisans",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "NDR", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "The Souled Store",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "RET", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Bira 91 Crafts",
      processes: [{ code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS }],
    },
    {
      name: "BlissClub Athletics",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Open Secret Foods",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "NDR", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Slurrp Farm Organics",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "ACC", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
    {
      name: "Heads Up For Tails",
      processes: [
        { code: "CS", rule: OperatingRule.EXCEPT_HOLIDAYS },
        { code: "RET", rule: OperatingRule.EXCEPT_HOLIDAYS },
      ],
    },
  ];

  const brandProcessMap: Record<string, Record<string, string>> = {};

  for (const bDef of brandDefs) {
    const brand = await prisma.brand.upsert({
      where: { name: bDef.name },
      update: { isActive: true },
      create: { name: bDef.name, isActive: true },
    });

    brandProcessMap[bDef.name] = {};

    for (const p of bDef.processes) {
      const processId = processes[p.code];
      const bp = await prisma.brandProcess.upsert({
        where: {
          brandId_processId: {
            brandId: brand.id,
            processId,
          },
        },
        update: {
          operatingRule: p.rule || OperatingRule.EXCEPT_HOLIDAYS,
          minCoverage: p.minCoverage || 1,
        },
        create: {
          brandId: brand.id,
          processId,
          operatingRule: p.rule || OperatingRule.EXCEPT_HOLIDAYS,
          minCoverage: p.minCoverage || 1,
        },
      });
      brandProcessMap[bDef.name][p.code] = bp.id;
    }
  }
  console.log("Brands and BrandProcesses seeded:", Object.keys(brandProcessMap).length);

  // 4. Assignments
  const singleResourceBrandNames = [
    "Blue Tokai Coffee", // Emp 0
    "Chaayos Express", // Emp 1
    "Boat Audio", // Emp 2
    "Lenskart Direct", // Emp 3
    "Mamaearth Naturals", // Emp 4
    "Epigamia Dairy", // Emp 5
    "Sleepy Owl Brews", // Emp 6
    "Phool Incense", // Emp 7
    "Country Delight", // Emp 8
    "Mokobara Travel", // Emp 9
    "Bombay Shaving Co", // Emp 10
    "Snitch Fashion", // Emp 11
    "Suta Artisans", // Emp 12
    "The Souled Store", // Emp 13
    "Bira 91 Crafts", // Emp 14
    "BlissClub Athletics", // Emp 15
    "Open Secret Foods", // Emp 16
    "Slurrp Farm Organics", // Emp 17
    "Heads Up For Tails", // Emp 31
  ];

  const assignmentRecords: { employeeId: string; brandProcessId: string }[] = [];

  // Assign single-resource brands
  singleResourceBrandNames.forEach((bName, idx) => {
    const empIdx = idx === 18 ? 31 : idx;
    const empId = employeeList[empIdx].id;
    const bpObj = brandProcessMap[bName];
    for (const pCode of Object.keys(bpObj)) {
      assignmentRecords.push({ employeeId: empId, brandProcessId: bpObj[pCode] });
    }
  });

  // Assign 5 Multi-resource brands:
  // M1: Kalyan Organics -> 3 employees on different processes (CS, ACC, NDR), one each
  assignmentRecords.push(
    {
      employeeId: employeeList[18].id,
      brandProcessId: brandProcessMap["Kalyan Organics"]["CS"],
    },
    {
      employeeId: employeeList[19].id,
      brandProcessId: brandProcessMap["Kalyan Organics"]["ACC"],
    },
    {
      employeeId: employeeList[20].id,
      brandProcessId: brandProcessMap["Kalyan Organics"]["NDR"],
    },
  );

  // M2: Zouk Lifestyle -> 2 employees sharing same process CS with minCoverage 2, plus RET handled by one of them
  assignmentRecords.push(
    {
      employeeId: employeeList[21].id,
      brandProcessId: brandProcessMap["Zouk Lifestyle"]["CS"],
    },
    {
      employeeId: employeeList[22].id,
      brandProcessId: brandProcessMap["Zouk Lifestyle"]["CS"],
    },
    {
      employeeId: employeeList[22].id,
      brandProcessId: brandProcessMap["Zouk Lifestyle"]["RET"],
    },
  );

  // M3: Paperboat Foods -> 2 employees, CS and NDR
  assignmentRecords.push(
    {
      employeeId: employeeList[23].id,
      brandProcessId: brandProcessMap["Paperboat Foods"]["CS"],
    },
    {
      employeeId: employeeList[24].id,
      brandProcessId: brandProcessMap["Paperboat Foods"]["NDR"],
    },
  );

  // M4: Wakefit Sleep -> 3 employees, two share ACC, one on CS
  assignmentRecords.push(
    {
      employeeId: employeeList[25].id,
      brandProcessId: brandProcessMap["Wakefit Sleep"]["ACC"],
    },
    {
      employeeId: employeeList[26].id,
      brandProcessId: brandProcessMap["Wakefit Sleep"]["ACC"],
    },
    {
      employeeId: employeeList[27].id,
      brandProcessId: brandProcessMap["Wakefit Sleep"]["CS"],
    },
  );

  // M5: Sugar Cosmetics -> 2 employees, CS and RET
  assignmentRecords.push(
    {
      employeeId: employeeList[28].id,
      brandProcessId: brandProcessMap["Sugar Cosmetics"]["CS"],
    },
    {
      employeeId: employeeList[29].id,
      brandProcessId: brandProcessMap["Sugar Cosmetics"]["RET"],
    },
  );

  // Multi-brand allocation:
  assignmentRecords.push({
    employeeId: employeeList[20].id,
    brandProcessId: brandProcessMap["Paperboat Foods"]["NDR"],
  });

  assignmentRecords.push(
    {
      employeeId: employeeList[30].id,
      brandProcessId: brandProcessMap["Sugar Cosmetics"]["RET"],
    },
    {
      employeeId: employeeList[30].id,
      brandProcessId: brandProcessMap["Wakefit Sleep"]["CS"],
    },
  );

  // Create assignments with skipDuplicates
  await prisma.assignment.createMany({
    data: assignmentRecords,
    skipDuplicates: true,
  });
  console.log("Assignments created:", assignmentRecords.length);

  // 5. Holidays (~12 Indian public holidays for current year 2026 and next year 2027)
  const holidayDefs = [
    // 2026
    { date: "2026-01-26", name: "Republic Day" },
    { date: "2026-03-04", name: "Holi" },
    { date: "2026-03-21", name: "Id-ul-Fitr" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-14", name: "Dr. Ambedkar Jayanti" },
    { date: "2026-05-01", name: "Maharashtra Day / Labour Day" },
    { date: "2026-08-15", name: "Independence Day" },
    { date: "2026-09-04", name: "Janmashtami" },
    { date: "2026-10-02", name: "Mahatma Gandhi Jayanti" },
    { date: "2026-10-20", name: "Dussehra" },
    { date: "2026-11-08", name: "Diwali" },
    { date: "2026-12-25", name: "Christmas" },
    // 2027
    { date: "2027-01-26", name: "Republic Day" },
    { date: "2027-03-22", name: "Holi" },
    { date: "2027-03-10", name: "Id-ul-Fitr" },
    { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-04-14", name: "Dr. Ambedkar Jayanti" },
    { date: "2027-05-01", name: "Maharashtra Day / Labour Day" },
    { date: "2027-08-15", name: "Independence Day" },
    { date: "2027-08-25", name: "Janmashtami" },
    { date: "2027-10-02", name: "Mahatma Gandhi Jayanti" },
    { date: "2027-10-09", name: "Dussehra" },
    { date: "2027-10-28", name: "Diwali" },
    { date: "2027-12-25", name: "Christmas" },
  ];

  for (const h of holidayDefs) {
    const d = new Date(`${h.date}T00:00:00.000Z`);
    await prisma.holiday.upsert({
      where: { date: d },
      update: { name: h.name },
      create: { date: d, name: h.name },
    });
  }
  console.log("Holidays seeded:", holidayDefs.length);

  // 6. Sample Leaves (6 sample leaves across different employees in next calendar month December 2026)
  const sampleLeaves = [
    // (a) Single employee of ALL_365 single-resource brand (Chaayos Express dedicated employee)
    {
      employeeId: employeeList[1].id,
      startDate: "2026-12-14",
      endDate: "2026-12-18",
      type: LeaveType.LEAVE,
      note: "Medical leave",
    },
    // (b) One employee of the 3-person brand M1 (Kalyan Organics)
    {
      employeeId: employeeList[18].id,
      startDate: "2026-12-07",
      endDate: "2026-12-11",
      type: LeaveType.LEAVE,
      note: "Personal travel",
    },
    // 4 other employees
    {
      employeeId: employeeList[2].id,
      startDate: "2026-12-02",
      endDate: "2026-12-04",
      type: LeaveType.COMP_OFF,
      note: "Comp off for weekend support",
    },
    {
      employeeId: employeeList[5].id,
      startDate: "2026-12-21",
      endDate: "2026-12-24",
      type: LeaveType.LEAVE,
      note: "Family vacation",
    },
    {
      employeeId: employeeList[10].id,
      startDate: "2026-12-28",
      endDate: "2026-12-30",
      type: LeaveType.LEAVE,
      note: "Year-end break",
    },
    {
      employeeId: employeeList[22].id,
      startDate: "2026-12-15",
      endDate: "2026-12-17",
      type: LeaveType.COMP_OFF,
      note: "Earned comp off",
    },
  ];

  for (const sl of sampleLeaves) {
    const startD = new Date(`${sl.startDate}T00:00:00.000Z`);
    const endD = new Date(`${sl.endDate}T00:00:00.000Z`);
    const exists = await prisma.leave.findFirst({
      where: {
        employeeId: sl.employeeId,
        startDate: startD,
        endDate: endD,
      },
    });
    if (!exists) {
      await prisma.leave.create({
        data: {
          employeeId: sl.employeeId,
          startDate: startD,
          endDate: endD,
          type: sl.type,
          note: sl.note,
        },
      });
    }
  }
  console.log("Sample leaves seeded:", sampleLeaves.length);
  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
