-- Shoto Point Production: safe, repeatable menu schema repair.
-- Run this script in MySQL Workbench. It explicitly selects the intended database.
USE shoto_point;

-- Add slug only when the existing cms_menus table does not have it.
SET @spp_has_slug := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_menus' AND COLUMN_NAME = 'slug'
);
SET @spp_sql := IF(@spp_has_slug = 0,
  'ALTER TABLE cms_menus ADD COLUMN slug VARCHAR(180) NULL AFTER name',
  'SELECT ''cms_menus.slug already exists'' AS migration_status'
);
PREPARE spp_stmt FROM @spp_sql; EXECUTE spp_stmt; DEALLOCATE PREPARE spp_stmt;

-- Keep the menu CRUD API's audit columns present on older schemas.
SET @spp_has_created_by := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_menus' AND COLUMN_NAME = 'created_by'
);
SET @spp_sql := IF(@spp_has_created_by = 0,
  'ALTER TABLE cms_menus ADD COLUMN created_by INT NULL',
  'SELECT ''cms_menus.created_by already exists'' AS migration_status'
);
PREPARE spp_stmt FROM @spp_sql; EXECUTE spp_stmt; DEALLOCATE PREPARE spp_stmt;

SET @spp_has_updated_by := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_menus' AND COLUMN_NAME = 'updated_by'
);
SET @spp_sql := IF(@spp_has_updated_by = 0,
  'ALTER TABLE cms_menus ADD COLUMN updated_by INT NULL',
  'SELECT ''cms_menus.updated_by already exists'' AS migration_status'
);
PREPARE spp_stmt FROM @spp_sql; EXECUTE spp_stmt; DEALLOCATE PREPARE spp_stmt;

-- Backfill readable unique slugs. The row ID suffix prevents collisions.
UPDATE cms_menus
SET slug = CONCAT(
  COALESCE(
    NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(COALESCE(name, 'menu'), '[^a-zA-Z0-9]+', '-'))), ''),
    'menu'
  ),
  '-', id
)
WHERE slug IS NULL OR TRIM(slug) = '';

ALTER TABLE cms_menus MODIFY COLUMN slug VARCHAR(180) NOT NULL;

-- Add a unique index only if slug is not already covered by a unique index.
SET @spp_has_unique_slug := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_menus'
    AND COLUMN_NAME = 'slug' AND NON_UNIQUE = 0
);
SET @spp_sql := IF(@spp_has_unique_slug = 0,
  'CREATE UNIQUE INDEX ux_cms_menus_slug ON cms_menus(slug)',
  'SELECT ''cms_menus.slug already has a unique index'' AS migration_status'
);
PREPARE spp_stmt FROM @spp_sql; EXECUTE spp_stmt; DEALLOCATE PREPARE spp_stmt;

-- Verify the migration and existing menu rows.
SHOW COLUMNS FROM cms_menus;
SELECT id, name, slug, location, parent_id, sort_order, enabled
FROM cms_menus
ORDER BY location, sort_order, id
LIMIT 50;
