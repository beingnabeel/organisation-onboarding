# Tenant Onboarding ETL Process

This repository contains the ETL (Extract, Transform, Load) process for tenant onboarding. The system extracts data from an Excel file, transforms it according to specific business rules, and prepares the data for loading into the database.

## ETL Process Overview

1. **Extraction**: Data is extracted from Excel file (`kiba_labs_data_sheet_new.xlsx`) and converted to JSON format.
2. **Transformation**: The extracted data is transformed into structured objects with proper UUIDs.
3. **Loading**: The transformed data is prepared for loading into the database (not implemented yet).

## Key Components

- **ETL Service**: Responsible for the entire ETL process.
- **UUID Generator**: Generates deterministic UUIDs for entity relationships.
- **Test Scripts**: Scripts to test and validate the ETL process.

## Output Files

- `etlextract.json`: Contains the raw extracted data from the Excel file.
- `etltransform.json`: Contains the transformed data with generated UUIDs.

## Transformation Details

The system transforms the organization details into the following structured data:

1. **Organization**: Contains the base organization details.
2. **Bank Master**: Contains banking institution details.
3. **Organization Bank Detail**: Links the organization to its bank accounts.
4. **Organization Tax Detail**: Contains tax-related information.
5. **Organization Compliance Detail**: Contains compliance-related information.

## UUID Generation

The system generates deterministic UUIDs for each entity, ensuring:

- UUIDs remain consistent across runs when input data is the same
- Dependencies between entities are maintained through UUID relationships
- Each UUID is generated based on unique identifying fields for that entity

## Running the ETL Process

To run the ETL process:

```bash
node src/scripts/testETL.js
```

This will:
1. Parse the Excel file
2. Generate the transformed data
3. Write the data to the output files