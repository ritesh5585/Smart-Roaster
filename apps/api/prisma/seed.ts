import { PrismaClient, OperatingRule } from "@prisma/client";

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

  // 3. Brands & Brand Processes
  // Multi-resource (5):
  // M1: Kalyan Organics (CS: ALL_365, ACC: EXCEPT_HOLIDAYS, NDR: NO_SUN_HOLIDAYS) -> 3 employees
  // M2: Zouk Lifestyle (CS: ALL_365 minCoverage 2, RET: EXCEPT_HOLIDAYS) -> 2 employees sharing CS, one also on RET
  // M3: Paperboat Foods (CS: EXCEPT_HOLIDAYS, NDR: EXCEPT_HOLIDAYS) -> 2 employees
  // M4: Wakefit Sleep (ACC: ALL_365 minCoverage 2, CS: EXCEPT_HOLIDAYS) -> 3 employees (two share ACC, one CS)
  // M5: Sugar Cosmetics (CS: EXCEPT_HOLIDAYS, RET: EXCEPT_HOLIDAYS) -> 2 employees

  // Single-resource (19): ONE dedicated employee assigned to ALL processes of that brand
  // S01: Blue Tokai Coffee (CS: EXCEPT_HOLIDAYS, ACC: NO_SUN_HOLIDAYS)
  // S02: Chaayos Express (CS: ALL_365) - single point of failure test
  // S03: Boat Audio (CS: EXCEPT_HOLIDAYS, RET: NO_SUN_HOLIDAYS)
  // S04: Lenskart Direct (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS, NDR: NO_SUN_HOLIDAYS)
  // S05: Mamaearth Naturals (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS)
  // S06: Epigamia Dairy (CS: EXCEPT_HOLIDAYS, NDR: EXCEPT_HOLIDAYS)
  // S07: Sleepy Owl Brews (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS)
  // S08: Phool Incense (CS: EXCEPT_HOLIDAYS)
  // S09: Country Delight (CS: EXCEPT_HOLIDAYS, NDR: EXCEPT_HOLIDAYS, RET: EXCEPT_HOLIDAYS)
  // S10: Mokobara Travel (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS)
  // S11: Bombay Shaving Co (CS: EXCEPT_HOLIDAYS, RET: EXCEPT_HOLIDAYS)
  // S12: Snitch Fashion (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS)
  // S13: Suta Artisans (CS: EXCEPT_HOLIDAYS, NDR: EXCEPT_HOLIDAYS)
  // S14: The Souled Store (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS, RET: EXCEPT_HOLIDAYS)
  // S15: Bira 91 Crafts (CS: EXCEPT_HOLIDAYS)
  // S16: BlissClub Athletics (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS)
  // S17: Open Secret Foods (CS: EXCEPT_HOLIDAYS, NDR: EXCEPT_HOLIDAYS)
  // S18: Slurrp Farm Organics (CS: EXCEPT_HOLIDAYS, ACC: EXCEPT_HOLIDAYS)
  // S19: Heads Up For Tails (CS: EXCEPT_HOLIDAYS, RET: EXCEPT_HOLIDAYS)

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
  console.log(
    "Brands and BrandProcesses seeded:",
    Object.keys(brandProcessMap).length,
  );

  // 4. Assignments
  // 32 employees (indexes 0 to 31)
  // Single-resource brands S01 to S19 (19 brands):
  // ONE dedicated employee assigned to ALL processes of that brand
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

  const assignmentRecords: { employeeId: string; brandProcessId: string }[] =
    [];

  // Assign single-resource brands
  singleResourceBrandNames.forEach((bName, idx) => {
    const empIdx = idx === 18 ? 31 : idx; // 0..17, and 31
    const empId = employeeList[empIdx].id;
    const bpObj = brandProcessMap[bName];
    for (const pCode of Object.keys(bpObj)) {
      assignmentRecords.push({
        employeeId: empId,
        brandProcessId: bpObj[pCode],
      });
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
  // Employees 28 and 29
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
  // "Two employees are assigned to two different brands each (to show multi-brand allocation)."
  // Employee 20 (already on Kalyan Organics) is also assigned to Paperboat Foods (NDR)
  assignmentRecords.push({
    employeeId: employeeList[20].id,
    brandProcessId: brandProcessMap["Paperboat Foods"]["NDR"],
  });

  // Employee 30 was not yet assigned -> assign to Sugar Cosmetics (RET) AND Wakefit Sleep (CS)
  // Making Employee 30 the second multi-brand employee!
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
