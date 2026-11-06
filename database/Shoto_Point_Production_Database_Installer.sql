CREATE DATABASE IF NOT EXISTS shoto_point CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shoto_point;

-- SHOTO POINT PRODUCTION DATABASE INSTALLER
-- Generated from the project's supplied SQL schema files.
-- Run this in MySQL Workbench against the Aiven MySQL connection.
-- Creates/uses database shoto_point. Tables use IF NOT EXISTS.



-- ===== SOURCE: database/shoto_point_admin.sql =====

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


-- ===== SOURCE: database/cms-v3-schema.sql =====
CREATE TABLE IF NOT EXISTS cms_menus (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(160) NOT NULL,slug VARCHAR(180) NOT NULL UNIQUE,location VARCHAR(80) DEFAULT 'header',parent_id INT NULL,sort_order INT DEFAULT 0,enabled TINYINT(1) DEFAULT 1,target VARCHAR(20) DEFAULT '_self',url VARCHAR(500),created_by INT,updated_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_content_blocks (id BIGINT AUTO_INCREMENT PRIMARY KEY,section VARCHAR(180) NOT NULL,title VARCHAR(255),content_type VARCHAR(60) NOT NULL DEFAULT 'paragraph',placement VARCHAR(60) DEFAULT 'center',body LONGTEXT,media_url TEXT,link_url TEXT,settings_json JSON,status VARCHAR(30) DEFAULT 'draft',scheduled_at DATETIME,published_at DATETIME,created_by INT,updated_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX(section),INDEX(status),INDEX(scheduled_at)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_media (id BIGINT AUTO_INCREMENT PRIMARY KEY,original_name VARCHAR(255) NOT NULL,stored_name VARCHAR(255) NOT NULL,url TEXT NOT NULL,mime_type VARCHAR(160),media_type VARCHAR(40),size_bytes BIGINT DEFAULT 0,alt_text VARCHAR(500),caption TEXT,folder_name VARCHAR(180) DEFAULT 'uploads',tags VARCHAR(1000),uploaded_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(media_type),INDEX(created_at)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_analytics_events (id BIGINT AUTO_INCREMENT PRIMARY KEY,event_type VARCHAR(50) NOT NULL,entity_type VARCHAR(80),entity_id VARCHAR(120),path VARCHAR(2000),metadata_json JSON,visitor_hash CHAR(64),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(event_type),INDEX(entity_type),INDEX(created_at),INDEX(visitor_hash)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_reactions (id BIGINT AUTO_INCREMENT PRIMARY KEY,entity_type VARCHAR(80) NOT NULL,entity_id VARCHAR(120) NOT NULL,reaction VARCHAR(30) NOT NULL,visitor_hash CHAR(64),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY reaction_once(entity_type,entity_id,reaction,visitor_hash)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_comments (id BIGINT AUTO_INCREMENT PRIMARY KEY,entity_type VARCHAR(80) NOT NULL,entity_id VARCHAR(120) NOT NULL,name VARCHAR(160),email VARCHAR(320),body TEXT NOT NULL,status VARCHAR(30) DEFAULT 'pending',approved_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(status)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_settings (id INT PRIMARY KEY,company_name VARCHAR(255),site_url VARCHAR(500),timezone VARCHAR(80) DEFAULT 'Africa/Lagos',refresh_seconds INT DEFAULT 10,maintenance_mode TINYINT(1) DEFAULT 0,allow_comments TINYINT(1) DEFAULT 1,allow_reactions TINYINT(1) DEFAULT 1,require_approval TINYINT(1) DEFAULT 1,updated_by INT,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_social_settings (id INT PRIMARY KEY,facebook TEXT,instagram TEXT,youtube TEXT,tiktok TEXT,x_url TEXT,whatsapp TEXT,linkedin TEXT,share_enabled TINYINT(1) DEFAULT 1,updated_by INT,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_plugins (id INT AUTO_INCREMENT PRIMARY KEY,plugin_key VARCHAR(100) UNIQUE,name VARCHAR(180),category VARCHAR(80),enabled TINYINT(1) DEFAULT 0,config_json JSON,updated_by INT,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_notifications (id BIGINT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255),message TEXT,type VARCHAR(40) DEFAULT 'info',audience VARCHAR(80) DEFAULT 'admin',status VARCHAR(30) DEFAULT 'unread',created_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(status)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_messages (id BIGINT AUTO_INCREMENT PRIMARY KEY,channel VARCHAR(30) DEFAULT 'internal',recipient VARCHAR(320),subject VARCHAR(255),body TEXT,status VARCHAR(30) DEFAULT 'queued',provider_message_id VARCHAR(255),created_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_wallet (id INT PRIMARY KEY,balance DECIMAL(18,2) DEFAULT 0,currency VARCHAR(10) DEFAULT 'NGN',updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_wallet_transactions (id BIGINT AUTO_INCREMENT PRIMARY KEY,type VARCHAR(30),amount DECIMAL(18,2),reference VARCHAR(180),status VARCHAR(30) DEFAULT 'pending',note TEXT,created_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(status),INDEX(type)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_meeting_links (id BIGINT AUTO_INCREMENT PRIMARY KEY,meeting_id BIGINT,provider VARCHAR(40),title VARCHAR(255),join_url TEXT,host_url TEXT,passcode VARCHAR(120),status VARCHAR(30) DEFAULT 'pending',created_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_audit (id BIGINT AUTO_INCREMENT PRIMARY KEY,admin_id INT,action VARCHAR(100),module VARCHAR(100),entity_id VARCHAR(120),details_json JSON,ip_address VARCHAR(64),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(admin_id),INDEX(created_at)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_approvals (id BIGINT AUTO_INCREMENT PRIMARY KEY,module VARCHAR(100),entity_id VARCHAR(120),requested_by INT,status VARCHAR(30) DEFAULT 'pending',reviewer_id INT,notes TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,reviewed_at DATETIME,INDEX(status),INDEX(module)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cms_revisions (id BIGINT AUTO_INCREMENT PRIMARY KEY,entity_type VARCHAR(100),entity_id VARCHAR(120),snapshot_json JSON,created_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(entity_type,entity_id)) ENGINE=InnoDB;


-- ===== SOURCE: database/production-deployment-schema.sql =====

CREATE TABLE IF NOT EXISTS production_registrations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 reference VARCHAR(80) NOT NULL UNIQUE,
 payload_json JSON NOT NULL,
 email VARCHAR(255) NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(status), INDEX(email), INDEX(created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS public_contacts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 form_type VARCHAR(60) NOT NULL DEFAULT 'website',
 name VARCHAR(180) NULL,
 email VARCHAR(255) NULL,
 phone VARCHAR(60) NULL,
 subject VARCHAR(255) NULL,
 message TEXT NOT NULL,
 payload_json JSON NULL,
 status ENUM('new','read','closed') NOT NULL DEFAULT 'new',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(status), INDEX(form_type), INDEX(created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS syfm_memberships (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 application_id VARCHAR(80) NOT NULL UNIQUE,
 full_name VARCHAR(255) NULL,
 email VARCHAR(255) NULL,
 phone VARCHAR(60) NULL,
 payload_json JSON NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(status), INDEX(email), INDEX(created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS syfm_contacts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(180) NULL,
 email VARCHAR(255) NULL,
 subject VARCHAR(255) NULL,
 message TEXT NOT NULL,
 payload_json JSON NULL,
 status ENUM('new','read','closed') NOT NULL DEFAULT 'new',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(status), INDEX(created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paystack_webhook_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id VARCHAR(255) NULL UNIQUE,
 event_name VARCHAR(120) NOT NULL,
 payload_json JSON NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(event_name), INDEX(created_at)
) ENGINE=InnoDB;


-- ===== SOURCE: database/backend-team-and-admin.sql =====
-- Run after the existing Shoto Point SQL files.
CREATE TABLE IF NOT EXISTS spp_team_members (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(180) NOT NULL, role VARCHAR(180) NOT NULL,
 group_key ENUM('ceo','administrative','senior') NOT NULL DEFAULT 'ceo',
 display_order INT NOT NULL DEFAULT 0, short_bio TEXT, biography LONGTEXT,
 image_url VARCHAR(2000), active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_team_group_active (group_key,active,display_order)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS spp_news_articles (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(300) NOT NULL, slug VARCHAR(320) NOT NULL UNIQUE,
 category VARCHAR(120) NOT NULL DEFAULT 'SPP Originals', status ENUM('Draft','Pending review','Scheduled','Published') NOT NULL DEFAULT 'Draft',
 author VARCHAR(180), excerpt TEXT, body LONGTEXT, image_url VARCHAR(2000), featured TINYINT(1) NOT NULL DEFAULT 0,
 scheduled_at DATETIME NULL, published_at DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_news_public(status,published_at,scheduled_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS spp_admin_settings (setting_key VARCHAR(100) PRIMARY KEY, setting_value JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
INSERT INTO spp_admin_settings(setting_key,setting_value) VALUES ('syfm_navigation',JSON_OBJECT('navigation',JSON_ARRAY(),'newsCategories',JSON_ARRAY('All headlines','Nigeria','Politics','Celebrities','Movies & Film','Actors','Musicians','Talents','Football','Media','Tech','World','SPP Originals'),'joinUrl','MemberShip.html')) ON DUPLICATE KEY UPDATE setting_key=setting_key;


-- ===== SOURCE: database/production-enhancements.sql =====
-- Shoto Point Production: production enhancements
CREATE TABLE IF NOT EXISTS sp_live_streams (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, provider VARCHAR(40) NOT NULL, embed_url TEXT NOT NULL, thumbnail_url TEXT NULL, status VARCHAR(30) DEFAULT 'scheduled', starts_at DATETIME NULL, description TEXT NULL, created_by BIGINT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX(status), INDEX(starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sp_page_templates (
 id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(180) NOT NULL, category VARCHAR(80) DEFAULT 'classic', description TEXT, template_json JSON NOT NULL, active TINYINT(1) DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sp_page_settings (
 page_slug VARCHAR(180) PRIMARY KEY, template_id INT NULL, green_theme TINYINT(1) DEFAULT 1, font_family VARCHAR(180) DEFAULT 'DM Sans', font_size VARCHAR(30) DEFAULT '16px', accent VARCHAR(30) DEFAULT '#d9b45b', updated_by BIGINT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sp_code_revisions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, file_key VARCHAR(180) NOT NULL, content LONGTEXT NOT NULL, status VARCHAR(30) DEFAULT 'saved', created_by BIGINT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(file_key), INDEX(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sp_social_share_settings (
 id INT PRIMARY KEY, facebook TINYINT(1) DEFAULT 1, whatsapp TINYINT(1) DEFAULT 1, x TINYINT(1) DEFAULT 1, telegram TINYINT(1) DEFAULT 1, email TINYINT(1) DEFAULT 1, copy_link TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO sp_social_share_settings(id) VALUES(1);
