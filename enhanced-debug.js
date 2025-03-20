require("dotenv").config();
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");

// Log database connection details for debugging
console.log(
  "DATABASE_URL:",
  process.env.DATABASE_URL ? "Configured (value hidden)" : "Not configured"
);

const prisma = new PrismaClient();

/**
 * Enhanced debugging script for employee object insertion issues
 * This script will:
 * 1. Check database for existing employees
 * 2. Test endpoint availability for employee insertion
 * 3. Create and attempt to insert a test employee
 * 4. Log detailed information at each step
 */
async function enhancedEmployeeDebug() {
  console.log("\n📋 ENHANCED EMPLOYEE INSERTION DEBUGGING");
  console.log("============================================");

  try {
    // Step 1: Check database for existing employees
    console.log("\n🔍 Step 1: Checking database for existing employees...");
    const existingEmployees = await prisma.employee.findMany({
      take: 5, // Only get a few for display purposes
    });

    if (existingEmployees.length > 0) {
      console.log(
        `Found ${existingEmployees.length} existing employees in database.`
      );
      console.log(
        "Sample employee:",
        JSON.stringify(existingEmployees[0], null, 2)
      );
    } else {
      console.log("No existing employees found in database.");
    }

    // Step 2: Test endpoint availability
    console.log("\n🔌 Step 2: Testing API endpoint availability...");
    const baseURL = "http://localhost:8085"; // Adjust to match your API URL

    try {
      const healthResponse = await axios.get(`${baseURL}/api/health`);
      console.log(
        `API health check response: ${healthResponse.status} ${healthResponse.statusText}`
      );
    } catch (healthError) {
      console.error(`API health check failed: ${healthError.message}`);
      if (healthError.code === "ECONNREFUSED") {
        console.error(
          `⚠️ Cannot connect to API server at ${baseURL}. Is the server running?`
        );
        return;
      }
    }

    // Step 3: Gather required foreign key references
    console.log("\n🔗 Step 3: Gathering required foreign key references...");

    // Get a valid org_id
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      console.error(
        "⚠️ No organization found. Please create an organization first."
      );
      return;
    }
    console.log(`Using org_id: ${organization.org_id}`);

    // Get a valid employment_type_id
    const employmentType = await prisma.employmentType.findFirst();
    if (!employmentType) {
      console.error(
        "⚠️ No employment type found. Please create an employment type first."
      );
      return;
    }
    console.log(
      `Using employment_type_id: ${employmentType.employment_type_id}`
    );

    // Get a valid dept_id
    const department = await prisma.department.findFirst();
    if (!department) {
      console.error(
        "⚠️ No department found. Please create a department first."
      );
      return;
    }
    console.log(`Using dept_id: ${department.dept_id}`);

    // Get a valid job_title_id
    const jobTitle = await prisma.jobTitle.findFirst();
    if (!jobTitle) {
      console.error("⚠️ No job title found. Please create a job title first.");
      return;
    }
    console.log(`Using job_title_id: ${jobTitle.job_title_id}`);

    // Get a valid location_id
    const location = await prisma.organizationLocation.findFirst();
    if (!location) {
      console.error("⚠️ No location found. Please create a location first.");
      return;
    }
    console.log(`Using work_location_id: ${location.location_id}`);

    // Step 4: Create and insert test employee
    console.log("\n🧪 Step 4: Creating and inserting test employee...");

    // Generate unique IDs for testing
    const employeeId = uuidv4();
    const employeeNumber = `TEST-${Math.floor(Math.random() * 10000)}`;

    // Create a test employee object
    const employeeData = {
      employee_id: employeeId,
      org_id: organization.org_id,
      employee_number: employeeNumber,
      employment_type_id: employmentType.employment_type_id,
      dept_id: department.dept_id,
      work_location_id: location.location_id,
      job_title_id: jobTitle.job_title_id,
      title: "Mr",
      first_name: "Test",
      middle_name: null,
      last_name: "Employee",
      display_name: "Test Employee",
      date_of_birth: new Date("1990-01-01").toISOString(),
      gender: "male",
      official_email: "test.employee@example.com",
      personal_email: "test.personal@example.com",
      mobile_number: "9999999999",
      emergency_contact_name: "Emergency Contact",
      emergency_contact_relationship: "Parent",
      emergency_contact_number: "8888888888",
      date_joined: new Date().toISOString(),
      probation_end_date: new Date(
        new Date().setMonth(new Date().getMonth() + 3)
      ).toISOString(),
      confirmation_date: new Date(
        new Date().setMonth(new Date().getMonth() + 3)
      ).toISOString(),
      contract_end_date: null,
      reporting_manager_id: null,
      notice_period_days: 30,
      status: "active",
    };

    console.log("Test employee data:", JSON.stringify(employeeData, null, 2));

    // Try direct database insertion
    console.log(
      "\n🔹 First approach: Trying direct database insertion with Prisma..."
    );
    try {
      const prismaResult = await prisma.employee.create({
        data: employeeData,
      });
      console.log(
        "✅ PRISMA SUCCESS: Employee inserted directly into database!"
      );
      console.log("Inserted employee ID:", prismaResult.employee_id);
    } catch (prismaError) {
      console.error("❌ PRISMA FAILED:", prismaError.message);
      console.log("Detailed error:", prismaError);
    }

    // Try API insertion
    console.log("\n🔹 Second approach: Trying API endpoint insertion...");
    try {
      const apiResponse = await axios.post(
        `${baseURL}/api/employees`,
        employeeData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`API response status: ${apiResponse.status}`);
      console.log(
        "API response data:",
        JSON.stringify(apiResponse.data, null, 2)
      );

      if (apiResponse.data.status === "success") {
        console.log("✅ API SUCCESS: Employee inserted via API!");

        // Verify the employee was inserted by retrieving it
        try {
          const verifyResponse = await axios.get(
            `${baseURL}/api/employees/${employeeId}`,
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (verifyResponse.data.status === "success") {
            console.log(
              "✅ VERIFICATION SUCCESS: Employee retrieved successfully!"
            );
          } else {
            console.log(
              "❌ VERIFICATION FAILED: Could not retrieve the inserted employee"
            );
          }
        } catch (verifyError) {
          console.error("❌ VERIFICATION ERROR:", verifyError.message);
        }
      } else {
        console.log("❌ API FAILED: Could not insert employee");
      }
    } catch (apiError) {
      console.error("❌ API ERROR:", apiError.message);
      if (apiError.response) {
        console.error("Response status:", apiError.response.status);
        console.error(
          "Response data:",
          JSON.stringify(apiError.response.data, null, 2)
        );
      }
    }

    // Step 5: Test the endpoint with a direct test object via the consumer service approach
    console.log(
      "\n🔹 Third approach: Testing AMQP message consumption simulation..."
    );
    console.log(
      "Create a separate script that simulates message consumption for this employee"
    );
    console.log(
      "You can test this by running the test-employee-insertion.js script"
    );
  } catch (error) {
    console.error("\n❌ OVERALL ERROR:", error.message);
    console.error(error);
  } finally {
    // Close Prisma connection
    await prisma.$disconnect();
    console.log("\n============================================");
    console.log("🏁 Employee debug process completed");
  }
}

enhancedEmployeeDebug().catch(console.error);
