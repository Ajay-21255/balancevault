require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/db");

async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set");
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      password: hashedPassword,
      name: "Administrator",
      role: "ADMIN",
      status: "ACTIVE",
    },
    update: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true, role: true },
  });

  console.log(`admin ready: ${user.email}`);
}

bootstrapAdmin()
  .catch((error) => {
    console.error("Failed to bootstrap administrator:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
