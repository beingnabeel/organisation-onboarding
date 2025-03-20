const { PrismaClient } = require("@prisma/client");

// Use the provided database URL directly
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  try {
    // Check employee count
    const employeeCount = await prisma.employee.count();
    console.log(`Total employees in database: ${employeeCount}`);

    // If we have employees, show a few examples
    if (employeeCount > 0) {
      const employees = await prisma.employee.findMany({
        take: 3,
      });
      console.log("Sample employees:", JSON.stringify(employees, null, 2));
    } else {
      console.log("No employees found in the database");
    }

    // Check counts of related tables
    const personalDetailsCount = await prisma.employeePersonalDetail.count();
    const bankDetailsCount = await prisma.employeeBankDetail.count();
    const financialDetailsCount = await prisma.employeeFinancialDetail.count();

    console.log(`Employee personal details count: ${personalDetailsCount}`);
    console.log(`Employee bank details count: ${bankDetailsCount}`);
    console.log(`Employee financial details count: ${financialDetailsCount}`);
  } catch (error) {
    console.error("Error querying database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
