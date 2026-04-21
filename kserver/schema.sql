CREATE DATABASE IF NOT EXISTS mysongdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mysongdb;


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

CREATE TABLE IF NOT EXISTS user_songbooks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  book_uuid CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  internal_title VARCHAR(255) NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  pdf_blob LONGBLOB NOT NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  page_count INT UNSIGNED NULL,
  checksum_sha256 CHAR(64) NULL,
  song_count INT UNSIGNED NOT NULL DEFAULT 0,
  analysis_handle VARCHAR(255) NULL,
  analysis_status VARCHAR(100) NULL,
  catalog_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_songbooks_user_book_uuid (user_id, book_uuid),
  UNIQUE KEY uq_user_songbooks_user_filename (user_id, original_filename),
  KEY idx_user_songbooks_user_id (user_id),
  CONSTRAINT fk_user_songbooks_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_songbooks_data (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  songbooks_version INT UNSIGNED NOT NULL,
  exported_at DATETIME NULL,
  book_count INT UNSIGNED NOT NULL DEFAULT 0,
  source_file_count INT UNSIGNED NOT NULL DEFAULT 0,
  byte_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  chunk_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_songbooks_data_user_version (user_id, songbooks_version),
  KEY idx_user_songbooks_data_user_created (user_id, created_at),
  CONSTRAINT fk_user_songbooks_data_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_songbooks_data_chunks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  songbooks_data_id BIGINT UNSIGNED NOT NULL,
  chunk_index INT UNSIGNED NOT NULL,
  chunk_text MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_songbooks_data_chunks_index (songbooks_data_id, chunk_index),
  CONSTRAINT fk_user_songbooks_data_chunks_data
    FOREIGN KEY (songbooks_data_id) REFERENCES user_songbooks_data(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

GRANT ALL PRIVILEGES ON mysongdb.* TO 'songappuser'@'%';
FLUSH PRIVILEGES;
