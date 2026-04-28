import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();
const keyLength = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, keyLength).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

const users = [
  ["Planificacion y Adquisiciones", "Enrique Arenas", "enrique.arenas@formatto.cl", "admin", "Jefe de Planificacion de Produccion", "Plan01"],
  ["Planificacion y Adquisiciones", "David Reyes", "david.reyes@formatto.cl", "admin", "Jefe de Adquisiciones y Planificacion", "Plan02"],
  ["Planificacion y Adquisiciones", "Karol Jorquera", "karol.jorquera@formatto.cl", "admin", "Asistente de planificacion", "Plan03"],
  ["Planificacion y Adquisiciones", "Paola Cornejo", "paola.cornejo@formatto.cl", "admin", "Asistente de planificacion", "Plan04"],
  ["Planificacion y Adquisiciones", "Braulio Contreras", "braulio.contreras@formatto.cl", "lector", "Encargado de adquisiciones", "Plan05"],
  ["Produccion", "Luis Venegas", "luis.venegas@formatto.cl", "lector", "Jefe de produccion", "Prod01"],
  ["Produccion", "David Elgueta", "david.elgueta@formatto.cl", "lector", "Asistente de armado", "Prod02"],
  ["Armado", "Carlos Nunez", "carlos.nunez@formatto.cl", "lector", "Jefe de armado", "Arma01"],
  ["Armado", "Paul Sepulveda", "paul.sepulveda@formatto.cl", "lector", "Asistente de armado", "Arma02"],
  ["Logistica", "Jorge Troncoso", "jorge.troncoso@formatto.cl", "operador", "Jefe de logistica", "Logi01"],
  ["Logistica", "Claudia Munoz", "cmunoz@formatto.cl", "operador", "Encargada de logistica", "Logi02"],
  ["Gerencia", "Pablo Dittborn", "pablo.dittborn@formatto.cl", "lector", "Gerente comercial", "Geren01"],
  ["Gerencia", "Christian San Martin", "christian.sanmartin@formatto.cl", "lector", "Gerente de operaciones", "Geren02"],
  ["Instalaciones", "Victor Moreno", "vmoreno@formatto.cl", "lector", "Jefe de instalaciones", "Insta01"],
  ["Instalaciones", "Ana Guerrero", "ana.guerrero@formatto.cl", "lector", "Supervisor de obra", "Insta02"],
  ["Instalaciones", "Jose Rojas", "jose.rojas@formatto.cl", "lector", "Supervisor de obra", "Insta03"],
  ["Instalaciones", "Robinson Bello", "robinson.bello@formatto.cl", "lector", "Supervisor de obra", "Insta04"],
  ["Instalaciones", "Marcos Catalan", "marcos.catalan@formatto.cl", "lector", "Supervisor de obra", "Insta05"],
  ["Instalaciones", "Pablo Ponce", "pablo.ponce@formatto.cl", "lector", "Supervisor de obra", "Insta06"]
].map(([area, fullName, email, role, position, password]) => ({ area, fullName, email, role, position, password }));

const seen = new Set();
const rejected = [];
let created = 0;
let updated = 0;

for (const user of users) {
  const email = user.email.toLowerCase();
  if (seen.has(email)) {
    rejected.push({ email, reason: "duplicado en archivo fuente" });
    continue;
  }
  seen.add(email);

  const existing = await prisma.profile.findUnique({ where: { email } });
  await prisma.profile.upsert({
    where: { email },
    create: {
      email,
      fullName: user.fullName,
      role: user.role,
      area: user.area,
      position: user.position,
      passwordHash: hashPassword(user.password),
      mustChangePassword: true,
      active: true
    },
    update: {
      fullName: user.fullName,
      role: user.role,
      area: user.area,
      position: user.position,
      passwordHash: hashPassword(user.password),
      mustChangePassword: true,
      active: true
    }
  });

  if (existing) updated++;
  else created++;
}

const byArea = users.reduce((acc, user) => {
  acc[user.area] = (acc[user.area] ?? 0) + 1;
  return acc;
}, {});

const byRole = users.reduce((acc, user) => {
  acc[user.role] = (acc[user.role] ?? 0) + 1;
  return acc;
}, {});

console.log(`Usuarios creados: ${created}`);
console.log(`Usuarios actualizados: ${updated}`);
console.log(`Usuarios rechazados: ${rejected.length}`);
if (rejected.length) console.table(rejected);
console.log("Resumen por area:");
console.table(byArea);
console.log("Resumen por rol:");
console.table(byRole);

await prisma.$disconnect();
