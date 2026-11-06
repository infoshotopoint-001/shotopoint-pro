CREATE DATABASE IF NOT EXISTS shoto_point CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shoto_point;

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
