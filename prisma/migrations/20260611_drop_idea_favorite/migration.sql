-- Drop Idea.isFavorite: feature never implemented in the UI, only written via PATCH endpoint.
ALTER TABLE "Idea" DROP COLUMN IF EXISTS "isFavorite";
