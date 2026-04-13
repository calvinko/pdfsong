CREATE DATABASE IF NOT EXISTS bcircle CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bcircle;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_uuid CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_user_uuid (user_uuid),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(100) NULL,
  avatar_url VARCHAR(500) NULL,
  timezone VARCHAR(100) NULL,
  bio TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_profiles_user_id (user_id),
  CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_user_state_storage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  goal VARCHAR(255) NULL,
  selected_plan VARCHAR(50) NULL,
  search VARCHAR(255) NULL,
  days VARCHAR(20) NULL,
  active_reference VARCHAR(100) NULL,
  main_page VARCHAR(50) NULL,
  translation VARCHAR(20) NULL,
  reader_font_size SMALLINT NULL,
  show_todays_reading BOOLEAN NULL,
  show_additional_reader BOOLEAN NULL,
  additional_translation VARCHAR(20) NULL,
  progress_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_user_state_storage_user_id (user_id),
  CONSTRAINT fk_app_user_state_storage_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
