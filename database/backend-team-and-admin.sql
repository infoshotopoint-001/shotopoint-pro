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
