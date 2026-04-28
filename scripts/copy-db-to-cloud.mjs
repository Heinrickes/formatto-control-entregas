import { PrismaClient } from "@prisma/client";

const localUrl = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL;
const cloudUrl = process.env.CLOUD_DATABASE_URL;
const confirmed = process.env.CONFIRM_CLOUD_COPY === "YES";

if (!localUrl) {
  console.error("Falta LOCAL_DATABASE_URL o DATABASE_URL para leer la base local.");
  process.exit(1);
}

if (!cloudUrl) {
  console.error("Falta CLOUD_DATABASE_URL con la conexion de Supabase Cloud.");
  process.exit(1);
}

if (!confirmed) {
  console.error('Para copiar y reemplazar datos en cloud ejecuta con CONFIRM_CLOUD_COPY="YES".');
  process.exit(1);
}

if (localUrl === cloudUrl) {
  console.error("LOCAL_DATABASE_URL/DATABASE_URL y CLOUD_DATABASE_URL son iguales. Se cancela la copia.");
  process.exit(1);
}

const local = new PrismaClient({
  datasources: {
    db: {
      url: localUrl,
    },
  },
});

const cloud = new PrismaClient({
  datasources: {
    db: {
      url: cloudUrl,
    },
  },
});

const copy = async () => {
  const [profiles, programs, dispatches, statuses, events] = await Promise.all([
    local.profile.findMany(),
    local.program.findMany(),
    local.dispatch.findMany(),
    local.dispatchStatus.findMany(),
    local.dispatchEvent.findMany(),
  ]);

  console.log(`Leyendo local: ${programs.length} programas, ${dispatches.length} tareas, ${events.length} eventos.`);

  await cloud.$transaction([
    cloud.dispatchEvent.deleteMany(),
    cloud.dispatchStatus.deleteMany(),
    cloud.dispatch.deleteMany(),
    cloud.program.deleteMany(),
    cloud.profile.deleteMany(),
  ]);

  if (profiles.length) {
    await cloud.profile.createMany({ data: profiles });
  }

  if (programs.length) {
    await cloud.program.createMany({ data: programs });
  }

  if (dispatches.length) {
    await cloud.dispatch.createMany({ data: dispatches });
  }

  if (statuses.length) {
    await cloud.dispatchStatus.createMany({ data: statuses });
  }

  if (events.length) {
    await cloud.dispatchEvent.createMany({ data: events });
  }

  console.log(`Copia cloud terminada: ${programs.length} programas, ${dispatches.length} tareas, ${statuses.length} estados.`);
};

copy()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await local.$disconnect();
    await cloud.$disconnect();
  });
