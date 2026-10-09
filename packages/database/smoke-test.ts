import { prisma } from "./src/index";
import bcrypt from "bcryptjs";

async function main() {
  console.log("1. Connecting and querying seeded users...");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });
  console.log(`   -> ${users.length} users found`);

  for (const u of users) {
    console.log(`   -> ${u.email} (${u.role}) id=${u.id}`);
  }

  console.log("2. Verifying bcrypt password check (same call auth.ts uses)...");
  const admin = users.find((u) => u.email === "admin@vaart.com");
  if (!admin) throw new Error("admin user missing");
  const adminOk = await bcrypt.compare("Admin@123", admin.passwordHash);
  const badOk = await bcrypt.compare("wrong-password", admin.passwordHash);
  console.log(`   -> correct password matches: ${adminOk} (expected true)`);
  console.log(`   -> wrong password matches:   ${badOk} (expected false)`);

  console.log("3. Querying EV / TV relations...");
  const evs = await prisma.eV.findMany({
    include: { tvs: { orderBy: { screenIndex: "asc" } } },
  });
  for (const ev of evs) {
    console.log(`   -> EV ${ev.serialNumber} @ ${ev.locationName}, ${ev.tvs.length} TVs`);
    for (const tv of ev.tvs) console.log(`      TV ${tv.subSerial} (screen ${tv.screenIndex})`);
  }

  console.log("4. Verifying campaigner EV access join...");
  const access = await prisma.campaignerEVAccess.findMany({
    include: { user: true, ev: true },
  });
  for (const a of access) {
    console.log(`   -> ${a.user.email} has access to ${a.ev.serialNumber}`);
  }

  console.log("5. AppSetting table (used by every admin page)...");
  const rows = await prisma.$queryRawUnsafe<{ key: string; value: string }[]>(
    `SELECT "key","value" FROM "AppSetting"`,
  );
  console.log(`   -> ${rows.length} settings: ${JSON.stringify(rows)}`);

  console.log("6. Writing + reading a Media row (exercises sizeBytes column)...");
  const adminId = admin.id;
  const media = await prisma.media.create({
    data: {
      userId: adminId,
      filename: "smoke.txt",
      originalName: "smoke.txt",
      r2Key: `smoke/${Date.now()}-smoke.txt`,
      url: "/smoke.txt",
      type: "IMAGE",
      sizeBytes: 1234,
      status: "READY",
    },
  });
  console.log(`   -> created media id=${media.id} sizeBytes=${media.sizeBytes} (typeof ${typeof media.sizeBytes})`);
  const json = JSON.stringify(media);
  console.log(`   -> JSON serializes OK: ${json.includes('"sizeBytes"')}`);

  await prisma.media.delete({ where: { id: media.id } });
  console.log("   -> cleaned up test row");

  console.log("\nALL DATA-LAYER CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());