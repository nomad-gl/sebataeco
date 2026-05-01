-- Migration 0069: Add navLinkOrder column to users table
-- Stores the super-admin's preferred nav link order as a JSON array of href strings.
-- NULL = use the default order defined in NavBar.tsx.

ALTER TABLE users
  ADD COLUMN navLinkOrder TEXT NULL COMMENT 'JSON array of nav-link hrefs in super-admin preferred order';
