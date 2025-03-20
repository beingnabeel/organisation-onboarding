const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findOrganizations() {
  try {
    // Find the first few organizations
    const organizations = await prisma.Organization.findMany({
      take: 5
    });
    
    console.log('Available Organizations:');
    organizations.forEach(org => {
      console.log(`ID: ${org.org_id}, Name: ${org.org_name}`);
    });
    
  } catch (error) {
    console.error('Error finding organizations:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findOrganizations();
