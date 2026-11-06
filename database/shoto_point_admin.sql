CREATE DATABASE IF NOT EXISTS shoto_point CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shoto_point;

-- Existing core tables
CREATE TABLE IF NOT EXISTS admins (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 admin_id VARCHAR(40) NOT NULL UNIQUE,
 control_key VARCHAR(40) NOT NULL UNIQUE,
 first_name VARCHAR(100) NOT NULL,
 last_name VARCHAR(100) NOT NULL,
 email VARCHAR(255) NOT NULL UNIQUE,
 phone VARCHAR(40) NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 status ENUM('active','suspended') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(255) NOT NULL UNIQUE,
 username VARCHAR(100) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 first_name VARCHAR(100),
 last_name VARCHAR(100),
 phone VARCHAR(40),
 profile_json JSON NULL,
 status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_submissions (
 id VARCHAR(64) PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 content LONGTEXT NOT NULL,
 type VARCHAR(80),
 category VARCHAR(80),
 source VARCHAR(255),
 region VARCHAR(120),
 external_url VARCHAR(2000),
 submitted_by VARCHAR(120),
 submitter_email VARCHAR(255),
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 approved_by BIGINT UNSIGNED NULL,
 published_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_news_status_date(status,published_at),
 CONSTRAINT fk_news_admin FOREIGN KEY(approved_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS content_items (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 section VARCHAR(80) NOT NULL,
 content_type VARCHAR(40) NOT NULL,
 title VARCHAR(255) NOT NULL,
 description TEXT,
 body LONGTEXT,
 media_url VARCHAR(2000),
 download_url VARCHAR(2000),
 amount DECIMAL(12,2) DEFAULT 0,
 status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
 scheduled_at DATETIME NULL,
 created_by BIGINT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_content_section_status(section,status),
 CONSTRAINT fk_content_admin FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meeting_registrations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 registration_id VARCHAR(80) NOT NULL UNIQUE,
 platform VARCHAR(100) NOT NULL,
 full_name VARCHAR(180) NOT NULL,
 email VARCHAR(255) NOT NULL,
 phone VARCHAR(40),
 status ENUM('pending','approved','rejected','rescheduled','completed') NOT NULL DEFAULT 'pending',
 meeting_at DATETIME NULL,
 notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_meeting_status(status)
);

CREATE TABLE IF NOT EXISTS orders (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 reference VARCHAR(100) NOT NULL UNIQUE,
 email VARCHAR(255) NOT NULL,
 item_id BIGINT UNSIGNED NOT NULL,
 item_type VARCHAR(80) NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 status ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
 channel VARCHAR(30),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_orders_status(status)
);

CREATE TABLE IF NOT EXISTS transactions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 reference VARCHAR(100) NOT NULL UNIQUE,
 amount DECIMAL(12,2) NOT NULL,
 status VARCHAR(40) NOT NULL,
 payload JSON NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_resets (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 admin_id BIGINT UNSIGNED NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 used_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_reset_admin FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- New Control Centre tables
CREATE TABLE IF NOT EXISTS newsfeed_settings (
 id TINYINT UNSIGNED PRIMARY KEY,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
 stories_per_feed INT UNSIGNED NOT NULL DEFAULT 10,
 featured_enabled TINYINT(1) NOT NULL DEFAULT 1,
 breaking_enabled TINYINT(1) NOT NULL DEFAULT 1,
 breaking_text VARCHAR(500) NULL,
 breaking_link VARCHAR(2000) NULL,
 auto_refresh_enabled TINYINT(1) NOT NULL DEFAULT 1,
 auto_refresh_seconds INT UNSIGNED NOT NULL DEFAULT 300,
 sort_order ENUM('newest','oldest','featured','manual') NOT NULL DEFAULT 'newest',
 layout ENUM('grid','list','hybrid') NOT NULL DEFAULT 'hybrid',
 show_images TINYINT(1) NOT NULL DEFAULT 1,
 show_descriptions TINYINT(1) NOT NULL DEFAULT 1,
 show_sources TINYINT(1) NOT NULL DEFAULT 1,
 show_video_feed TINYINT(1) NOT NULL DEFAULT 1,
 show_local_news TINYINT(1) NOT NULL DEFAULT 1,
 show_visitor_news TINYINT(1) NOT NULL DEFAULT 1,
 updated_by BIGINT UNSIGNED NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_newsfeed_admin FOREIGN KEY(updated_by) REFERENCES admins(id) ON DELETE SET NULL
);
INSERT INTO newsfeed_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id;

CREATE TABLE IF NOT EXISTS newsroom_categories (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 slug VARCHAR(100) NOT NULL UNIQUE,
 name VARCHAR(150) NOT NULL,
 description TEXT,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 display_order INT NOT NULL DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO newsroom_categories(slug,name,display_order) VALUES
('nigeria','Nigeria News',1),('politics','Politics',2),('business','Business',3),
('entertainment','Entertainment',4),('world','World News',5),('sports','Sports',6),
('technology','Technology',7),('health','Health',8),('education','Education',9);

CREATE TABLE IF NOT EXISTS newsroom_featured (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 description TEXT,
 image_url VARCHAR(2000),
 external_url VARCHAR(2000),
 category VARCHAR(100),
 position INT NOT NULL DEFAULT 0,
 status ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
 created_by BIGINT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_featured_admin FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS newsroom_media (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 media_type ENUM('image','video','link','document') NOT NULL,
 media_url VARCHAR(2000) NOT NULL,
 section VARCHAR(100) NOT NULL DEFAULT 'newsroom',
 description TEXT,
 status ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
 created_by BIGINT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_media_admin FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS seo_settings (
 id TINYINT UNSIGNED PRIMARY KEY,
 site_title VARCHAR(255) NOT NULL DEFAULT 'Shoto Point Production',
 meta_description VARCHAR(500),
 canonical_url VARCHAR(2000),
 robots_index TINYINT(1) NOT NULL DEFAULT 1,
 sitemap_enabled TINYINT(1) NOT NULL DEFAULT 1,
 news_schema_enabled TINYINT(1) NOT NULL DEFAULT 1,
 updated_by BIGINT UNSIGNED NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_seo_admin FOREIGN KEY(updated_by) REFERENCES admins(id) ON DELETE SET NULL
);
INSERT INTO seo_settings(id) VALUES (1) ON DUPLICATE KEY UPDATE id=id;

CREATE TABLE IF NOT EXISTS website_analytics (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 path VARCHAR(2000) NOT NULL,
 referrer VARCHAR(2000),
 visitor_hash CHAR(64),
 user_agent VARCHAR(1000),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_analytics_date(created_at),
 INDEX idx_analytics_path(path(255))
);

CREATE TABLE IF NOT EXISTS admin_activity (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 admin_id BIGINT UNSIGNED NULL,
 action VARCHAR(120) NOT NULL,
 entity_type VARCHAR(80),
 entity_id VARCHAR(100),
 details JSON NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_activity_date(created_at),
 CONSTRAINT fk_activity_admin FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS syfm_sections (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 slug VARCHAR(120) NOT NULL UNIQUE,
 title VARCHAR(255) NOT NULL,
 description TEXT,
 body LONGTEXT,
 image_url VARCHAR(2000),
 video_url VARCHAR(2000),
 external_url VARCHAR(2000),
 status ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
 display_order INT NOT NULL DEFAULT 0,
 created_by BIGINT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_syfm_admin FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
);
