-- The Missing Piece — Hostinger MySQL Schema
-- Compatible with MySQL 8.0+ / MariaDB 10.4+ (utf8mb4)
-- Import via Hostinger -> Websites -> Manage -> Databases -> Management -> Import
-- (or phpMyAdmin). Firebase Authentication stays active for user logins, keyed by user_id (Firebase UID).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
  `user_id` VARCHAR(128) NOT NULL,
  `display_name` VARCHAR(60) NOT NULL DEFAULT 'Player',
  `linked_tiktok_handle` VARCHAR(40) NOT NULL DEFAULT '',
  `preferred_language` VARCHAR(8) NOT NULL DEFAULT 'en',
  `dark_mode` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_users_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_progress` (
  `user_id` VARCHAR(128) NOT NULL,
  `bucket_id` VARCHAR(40) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`user_id`, `bucket_id`),
  KEY `idx_user_progress_updated_at` (`updated_at`),
  CONSTRAINT `fk_user_progress_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `registered_users` (
  `user_id` VARCHAR(128) NOT NULL,
  `display_name` VARCHAR(60) NOT NULL DEFAULT 'Player',
  `tiktok_connected` TINYINT(1) NOT NULL DEFAULT 0,
  `linked_tiktok_handle` VARCHAR(40) NOT NULL DEFAULT '',
  `auth_provider` VARCHAR(16) NOT NULL DEFAULT 'email',
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_registered_users_updated_at` (`updated_at`),
  KEY `idx_registered_users_tiktok` (`linked_tiktok_handle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `leaderboard` (
  `entry_id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `display_name` VARCHAR(60) NOT NULL DEFAULT 'Player',
  `game_id` VARCHAR(32) NOT NULL,
  `puzzle_id` VARCHAR(64) NOT NULL,
  `puzzle_title` VARCHAR(100) NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `metric_label` VARCHAR(60) NOT NULL,
  `sub_metric_label` VARCHAR(80) NOT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`entry_id`),
  KEY `idx_leaderboard_game_score` (`game_id`, `score` DESC),
  KEY `idx_leaderboard_score` (`score` DESC),
  KEY `idx_leaderboard_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `highscores` (
  `score_id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `display_name` VARCHAR(60) NOT NULL DEFAULT 'Player',
  `puzzle_id` VARCHAR(64) NOT NULL,
  `mode` VARCHAR(32) NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `words_found` INT NOT NULL DEFAULT 0,
  `total_words` INT NOT NULL DEFAULT 1,
  `bonus_words_count` INT NOT NULL DEFAULT 0,
  `found_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`score_id`),
  KEY `idx_highscores_user_score` (`user_id`, `score` DESC),
  KEY `idx_highscores_score` (`score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
