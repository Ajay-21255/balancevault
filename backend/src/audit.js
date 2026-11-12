const prisma = require("./db");

async function log(actorId, action, target, metadata) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        target,
        metadata: metadata === undefined ? undefined : metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

module.exports = { log };
