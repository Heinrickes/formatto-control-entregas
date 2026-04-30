import { PrismaClient } from "@prisma/client";

const cloudUrl = process.env.CLOUD_DATABASE_URL;

if (!cloudUrl) {
  console.error("Falta CLOUD_DATABASE_URL para inspeccionar Supabase Cloud.");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: cloudUrl,
    },
  },
});

const inspect = async () => {
  const tables = await prisma.$queryRaw`
    select table_schema, table_name, table_type
    from information_schema.tables
    where table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name
  `;

  const schemas = await prisma.$queryRaw`
    select schema_name
    from information_schema.schemata
    where schema_name not like 'pg_%'
      and schema_name <> 'information_schema'
    order by schema_name
  `;

  console.log(JSON.stringify({ schemas, tables }, null, 2));
};

inspect()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
