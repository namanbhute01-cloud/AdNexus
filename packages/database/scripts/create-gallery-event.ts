import { prisma } from "../src/index";

function argOf(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function intArg(flag: string, fallback: number) {
  const raw = argOf(flag);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${flag.replace(/^--/, "")} must be an integer, got "${raw}"`);
  }
  return parsed;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function main() {
  const slug = argOf("--slug");
  const name = argOf("--name");
  const campaignId = argOf("--campaignId");

  if (!slug || !name || !campaignId) {
    throw new Error(
      "Usage: tsx scripts/create-gallery-event.ts --slug navaratri-2026 --name \"Navaratri 2026\" --campaignId <id>",
    );
  }

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid slug "${slug}". Use lowercase words separated by single hyphens.`);
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, status: true },
  });

  if (!campaign) {
    throw new Error(`Campaign "${campaignId}" does not exist.`);
  }

  const event = await prisma.galleryEvent.upsert({
    where: { slug },
    update: { name, campaignId },
    create: {
      slug,
      name,
      campaignId,
      maxFilesPerRequest: intArg("--maxFiles", 5),
      maxFileBytes: intArg("--maxFileBytes", 10485760),
      maxPending: intArg("--maxPending", 500),
      perTokenCap: intArg("--perTokenCap", 30),
      displaySeconds: intArg("--displaySeconds", 8),
    },
  });

  console.log("Gallery event ready");
  console.log(`  id         ${event.id}`);
  console.log(`  slug       ${event.slug}`);
  console.log(`  name       ${event.name}`);
  console.log(`  campaign   ${campaign.name} (${campaign.status})`);
  console.log(`  open       ${event.isOpen}`);
  console.log(`  per photo  ${(event.maxFileBytes / 1048576).toFixed(0)} MB, ${event.displaySeconds}s on screen`);
  console.log("");
  console.log(`  public URL: ${process.env.PUBLIC_BASE_URL ?? "http://localhost:3000"}/contribute/${event.slug}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());