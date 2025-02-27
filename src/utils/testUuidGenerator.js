const {
  generateUUID,
  generateDeterministicUUID,
  isValidUUID,
} = require("./prismaIdGenerator");

console.log("\n=== Testing UUID Generator Functions ===\n");

// Test 1: generateUUID()
console.log("Test 1: generateUUID()");
const uuid1 = generateUUID();
const uuid2 = generateUUID();
console.log("Generated UUID 1:", uuid1);
console.log("Generated UUID 2:", uuid2);
console.log("Are UUIDs different?", uuid1 !== uuid2);
console.log("Are both valid UUIDs?", isValidUUID(uuid1) && isValidUUID(uuid2));

// Test 2: generateDeterministicUUID()
console.log("\nTest 2: generateDeterministicUUID()");
const deterministicUUID1 = generateDeterministicUUID(
  "4d1edeaf-90c8-51d9-a338-05c4f737bd05",
  1
);
const deterministicUUID2 = generateDeterministicUUID(
  "4d1edeaf-90c8-51d9-a338-05c4f737bd05",
  1
);
const deterministicUUID3 = generateDeterministicUUID(
  "test@example.com",
  "profile"
);
console.log("Deterministic UUID 1 (email+user):", deterministicUUID1);
console.log("Deterministic UUID 2 (same input):", deterministicUUID2);
console.log("Deterministic UUID 3 (different context):", deterministicUUID3);
console.log(
  "Are UUID 1 and 2 same?",
  deterministicUUID1 === deterministicUUID2
);
console.log(
  "Are UUID 1 and 3 different?",
  deterministicUUID1 !== deterministicUUID3
);

// Test 3: isValidUUID()
console.log("\nTest 3: isValidUUID()");
const validUUIDs = [
  generateUUID(),
  "123e4567-e89b-12d3-a456-426614174000",
  deterministicUUID1,
];
const invalidUUIDs = [
  "123456",
  "not-a-uuid",
  "123e4567-e89b-12d3-a456-42661417400g", // invalid character
  "123e4567-e89b-12d3-a456", // too short
];

console.log("Testing valid UUIDs:");
validUUIDs.forEach((uuid) => {
  console.log(`"${uuid}" is valid?`, isValidUUID(uuid));
});

console.log("\nTesting invalid UUIDs:");
invalidUUIDs.forEach((uuid) => {
  console.log(`"${uuid}" is valid?`, isValidUUID(uuid));
});
