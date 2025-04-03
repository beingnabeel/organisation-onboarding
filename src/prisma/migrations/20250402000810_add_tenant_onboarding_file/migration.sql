-- CreateTable
CREATE TABLE "tenant_onboarding_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_name" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "s3_url" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_onboarding_files_pkey" PRIMARY KEY ("id")
);
