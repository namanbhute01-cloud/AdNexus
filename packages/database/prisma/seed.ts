import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

/**
 * Seed data.
 *
 * SECURITY (INSTRUCTIONS T10): the default credentials below are DEVELOPMENT
 * ONLY. On a production instance the dev accounts are never created, and the
 * admin is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD` instead. Running
 * `prisma db seed` against a production database therefore cannot reintroduce
 * `Admin@123`.
 */

const isProduction = process.env.NODE_ENV === "production"

const devAdminEmail = "admin@vaart.com"
const devAdminPassword = "Admin@123"
const devCampaignerEmail = "client@example.com"
const devCampaignerPassword = "Client@123"

async function main() {
  if (isProduction) {
    console.log("Production seed: skipping all development accounts.")
  } else {
    // Dev admin
    await prisma.user.upsert({
      where: { email: devAdminEmail },
      update: {},
      create: {
        email: devAdminEmail,
        name: "Admin",
        passwordHash: await bcrypt.hash(devAdminPassword, 12),
        role: "ADMIN",
      }
    })

    // Sample campaigner. The row is kept in every environment (INSTRUCTIONS T10
    // forbids deleting enum values or seeded data), but it can no longer sign
    // in because `authorize()` rejects any non-ADMIN role.
    const campaigner = await prisma.user.upsert({
      where: { email: devCampaignerEmail },
      update: {},
      create: {
        email: devCampaignerEmail,
        name: "Sample Client",
        passwordHash: await bcrypt.hash(devCampaignerPassword, 12),
        role: "CAMPAIGNER",
      }
    })

    // Sample EV
    const ev = await prisma.eV.upsert({
      where: { serialNumber: "NRT-EV-001" },
      update: {},
      create: { serialNumber: "NRT-EV-001", locationName: "MG Road, Bangalore" }
    })

    // 3 TVs in the EV
    for (let i = 1; i <= 3; i++) {
      await prisma.tV.upsert({
        where: { subSerial: `NRT-EV-001-TV${i}` },
        update: {},
        create: {
          evId: ev.id,
          subSerial: `NRT-EV-001-TV${i}`,
          screenIndex: i,
        }
      })
    }

    // Give campaigner access to EV
    await prisma.campaignerEVAccess.upsert({
      where: { userId_evId: { userId: campaigner.id, evId: ev.id } },
      update: {},
      create: { userId: campaigner.id, evId: ev.id }
    })

    console.log("Seed complete ✓ (development accounts)")
    return
  }

  // --- Production path: bootstrap the admin from the environment ---
  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin account was created.\n" +
      "Set both (password >= 12 chars) and re-run the seed, or create an admin manually."
    )
    return
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters")
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })

  if (existing) {
    console.log(`Admin ${email} already exists — password unchanged.`)
    return
  }

  await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME?.trim() || "Admin",
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    }
  })

  console.log(`Seed complete ✓ — admin ${email} created.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())