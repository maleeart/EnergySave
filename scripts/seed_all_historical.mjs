import { Redis } from "@upstash/redis";

const r = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ES_BASELINE_DATA = [
  {
    dept: "สก.ชธธ.",
    divs: [
      { name: "กบคธ-ธ.", count: 10 },
      { name: "กบห-ธ.", count: 24 },
      { name: "กปฟนม-ธ.", count: 6 },
      { name: "กปฟร-ธ.", count: 1 },
      { name: "กปฟรร-ธ.", count: 2 },
      { name: "กศม-ธ.", count: 11 },
      { name: "ขึ้นตรง ชธธ.", count: 6 },
      { name: "ทั่วไป", count: 17 },
    ]
  },
  {
    dept: "อคม.",
    divs: [
      { name: "กคภ-ธ.", count: 5 },
      { name: "กคว-ธ.", count: 12 },
      { name: "กผงม-ธ.", count: 8 },
      { name: "กวค-ธ.", count: 10 },
      { name: "สก. อคม.", count: 4 },
    ]
  },
  {
    dept: "อบค.",
    divs: [
      { name: "กกห-ธ.", count: 4 },
      { name: "กกอ-ธ.", count: 7 },
      { name: "กผงค-ธ.", count: 5 },
      { name: "กฟนม-ธ.", count: 8 },
      { name: "กมน-ธ.", count: 20 },
      { name: "สก. อบค.", count: 1 },
    ]
  },
  {
    dept: "อบฟ.",
    divs: [
      { name: "กททอ-ธ.", count: 12 },
      { name: "กบกม-ธ.", count: 23 },
      { name: "กบคพ-ธ.", count: 28 },
      { name: "กบมอ-ธ.", count: 7 },
      { name: "กผงฟ-ธ.", count: 6 },
      { name: "กมสว-ธ.", count: 18 },
      { name: "สก. อบฟ.", count: 1 },
      { name: "อื่นๆ: อค-บห.", count: 2 },
    ]
  },
  {
    dept: "อบย.",
    divs: [
      { name: "กคข-ธ.", count: 5 },
      { name: "กบร-ธ.", count: 6 },
      { name: "กผงย-ธ.", count: 7 },
      { name: "กวย-ธ.", count: 2 },
      { name: "สก. อบย.", count: 2 },
    ]
  },
  {
    dept: "อรอ.",
    divs: [
      { name: "กงค-ธ.", count: 2 },
      { name: "กทค-ธ.", count: 4 },
      { name: "กบอ-ธ.", count: 6 },
    ]
  },
  {
    dept: "อหข.",
    divs: [
      { name: "กขส-ห.", count: 5 },
      { name: "กซย-ห.", count: 24 },
      { name: "กวข-ห.", count: 10 },
      { name: "สก. อหข.", count: 4 },
    ]
  },
  {
    dept: "อื่นๆ",
    divs: [
      { name: "ทั่วไป", count: 2 },
    ]
  }
];

const EPAGO_BASELINE_DATA = [
  {
    dept: "สก.ชธธ.",
    divs: [
      { name: "กบคธ-ธ.", count: 1 },
      { name: "กบห-ธ.", count: 24 },
      { name: "กศม-ธ.", count: 8 },
      { name: "ขึ้นตรง ชธธ.", count: 2 },
      { name: "ทั่วไป", count: 12 },
    ]
  },
  {
    dept: "อคม.",
    divs: [
      { name: "กคภ-ธ.", count: 5 },
      { name: "กคว-ธ.", count: 12 },
      { name: "กผงม-ธ.", count: 8 },
      { name: "กวค-ธ.", count: 12 },
      { name: "สก. อคม.", count: 4 },
    ]
  },
  {
    dept: "อบค.",
    divs: [
      { name: "กกห-ธ.", count: 1 },
      { name: "กกอ-ธ.", count: 1 },
      { name: "กผงค-ธ.", count: 2 },
      { name: "กฟนม-ธ.", count: 1 },
      { name: "กมน-ธ.", count: 3 },
    ]
  },
  {
    dept: "อบฟ.",
    divs: [
      { name: "กททอ-ธ.", count: 1 },
      { name: "กบคพ-ธ.", count: 1 },
      { name: "กบมอ-ธ.", count: 1 },
      { name: "กผงฟ-ธ.", count: 1 },
      { name: "กมสว-ธ.", count: 1 },
    ]
  },
  {
    dept: "อรอ.",
    divs: [
      { name: "กทค-ธ.", count: 2 },
      { name: "กบอ-ธ.", count: 6 },
    ]
  },
  {
    dept: "อหข.",
    divs: [
      { name: "กขส-ห.", count: 1 },
      { name: "กซย-ห.", count: 1 },
      { name: "กวข-ห.", count: 2 },
      { name: "สก. อหข.", count: 2 },
    ]
  },
  {
    dept: "อื่นๆ",
    divs: [
      { name: "ทั่วไป", count: 1 },
    ]
  }
];

async function seed() {
  console.log("=== 1. Seeding EnergySave Baseline Data (337 records) ===");
  const existingEs = await r.hgetall("energysave:responses") || {};
  console.log(`Current EnergySave records in Redis: ${Object.keys(existingEs).length}`);

  let esSeq = 1;
  const esNewMap = {};
  let esTotalToSeed = 0;

  for (const deptItem of ES_BASELINE_DATA) {
    let deptCount = 0;
    for (const divItem of deptItem.divs) {
      for (let i = 1; i <= divItem.count; i++) {
        const empid = `HIST-ES-${String(esSeq).padStart(4, '0')}`;
        const key = `baseline-${deptItem.dept}-${divItem.name}-${i}`;
        const record = {
          name: `ผู้ประเมิน (${divItem.name} #${i})`,
          empid: empid,
          unit: deptItem.dept,
          subUnit: divItem.name,
          type: "พนักงาน",
          scores: [4, 4, 4, 4, 4, 4],
          at: "2026-11-04T04:22:00.000Z",
          _blobUrl: key,
          isHistorical: true
        };
        esNewMap[key] = JSON.stringify(record);
        esSeq++;
        deptCount++;
        esTotalToSeed++;
      }
    }
    console.log(`  -> ${deptItem.dept}: prepared ${deptCount} records`);
  }

  console.log(`Total EnergySave records prepared: ${esTotalToSeed}`);
  // Batch HSET in chunks of 50
  const esEntries = Object.entries(esNewMap);
  for (let i = 0; i < esEntries.length; i += 50) {
    const chunk = Object.fromEntries(esEntries.slice(i, i + 50));
    await r.hset("energysave:responses", chunk);
  }
  const afterEsCount = await r.hlen("energysave:responses");
  console.log(`EnergySave HLEN after seeding: ${afterEsCount} (expected: 337 + 16 = 353)\n`);

  console.log("=== 2. Seeding EPAGO Baseline Data (116 records) ===");
  const existingEp = await r.hgetall("epago:participants") || {};
  console.log(`Current EPAGO records in Redis: ${Object.keys(existingEp).length}`);

  let epSeq = 1;
  const epNewMap = {};
  let epTotalToSeed = 0;

  for (const deptItem of EPAGO_BASELINE_DATA) {
    let deptCount = 0;
    for (const divItem of deptItem.divs) {
      for (let i = 1; i <= divItem.count; i++) {
        const empId = `HIST-EP-${String(epSeq).padStart(4, '0')}`;
        const key = `baseline-${deptItem.dept}-${divItem.name}-${i}`;
        const record = {
          name: `ผู้เข้าร่วม (${divItem.name} #${i})`,
          empId: empId,
          emptype: "พนักงาน",
          dept: deptItem.dept,
          department: deptItem.dept,
          division: divItem.name,
          status: "completed",
          watched: ["vid-1", "vid-2"],
          watchedAt: { "vid-1": "2026-11-04 11:22", "vid-2": "2026-11-04 11:22" },
          regTime: "2026-11-04 11:22",
          submittedAt: "2026-11-04T04:22:00.000Z",
          _blobUrl: key,
          isHistorical: true
        };
        epNewMap[key] = JSON.stringify(record);
        epSeq++;
        deptCount++;
        epTotalToSeed++;
      }
    }
    console.log(`  -> ${deptItem.dept}: prepared ${deptCount} records`);
  }

  console.log(`Total EPAGO records prepared: ${epTotalToSeed}`);
  // Batch HSET in chunks of 50
  const epEntries = Object.entries(epNewMap);
  for (let i = 0; i < epEntries.length; i += 50) {
    const chunk = Object.fromEntries(epEntries.slice(i, i + 50));
    await r.hset("epago:participants", chunk);
  }
  const afterEpCount = await r.hlen("epago:participants");
  console.log(`EPAGO HLEN after seeding: ${afterEpCount} (expected: 116 + 6 = 122)\n`);

  console.log("=== SEEDING COMPLETED SUCCESSFULLY ===");
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
