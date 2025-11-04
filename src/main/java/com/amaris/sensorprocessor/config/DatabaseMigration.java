package com.amaris.sensorprocessor.config;

import java.sql.SQLException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Database migration component that runs on application startup.
 * Fixes the Users table password field size issue without modifying data.sql.
 */
@Component
@ConditionalOnExpression("'${spring.datasource.url:}'.contains('sqlite')")
public class DatabaseMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseMigration.class);
    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public DatabaseMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        log.info("Running database migration checks...");
        migrateUsersTablePasswordField();
        log.info("Database migration completed.");
    }

    /**
     * Migrates the Users table to fix the password field size from VARCHAR(50) to VARCHAR(100).
     * This is necessary because BCrypt password hashes are 60 characters long.
     * 
     * SQLite doesn't support ALTER COLUMN, so we need to:
     * 1. Create a new table with correct schema
     * 2. Copy all data
     * 3. Drop old table
     * 4. Rename new table
     */
    private void migrateUsersTablePasswordField() {
        try {
            // Check if migration is needed by checking the schema
            String checkSql = "SELECT sql FROM sqlite_master WHERE type='table' AND name='Users'";
            String currentSchema = jdbcTemplate.queryForObject(checkSql, String.class);
            
            // Normalize schema by removing extra spaces for comparison
            String normalizedSchema = currentSchema != null ? currentSchema.replaceAll("\\s+", " ") : "";
            
            if (normalizedSchema.contains("password VARCHAR (50)") || normalizedSchema.contains("password VARCHAR(50)")) {
                log.warn("Users table has incorrect password field size (VARCHAR(50)). Migrating to VARCHAR(100)...");
                
                // Step 1: Create new table with correct schema
                log.info("Step 1: Creating Users_new table with correct schema...");
                jdbcTemplate.execute(
                    "CREATE TABLE Users_new (" +
                    "    username VARCHAR(50) PRIMARY KEY NOT NULL, " +
                    "    firstname VARCHAR(50) NOT NULL, " +
                    "    lastname VARCHAR(50) NOT NULL, " +
                    "    password VARCHAR(100) NOT NULL, " +
                    "    role VARCHAR(20) NOT NULL, " +
                    "    email VARCHAR(100) NOT NULL, " +
                    "    icon VARCHAR(100) DEFAULT 'default-avatar.png'" +
                    ")"
                );
                
                // Step 2: Copy all existing data
                log.info("Step 2: Copying existing user data...");
                int rowsCopied = jdbcTemplate.update(
                    "INSERT INTO Users_new (username, firstname, lastname, password, role, email, icon) " +
                    "SELECT username, firstname, lastname, password, role, email, icon FROM Users"
                );
                log.info("Copied {} users to new table", rowsCopied);
                
                // Step 3: Drop old table
                log.info("Step 3: Dropping old Users table...");
                jdbcTemplate.execute("DROP TABLE Users");
                
                // Step 4: Rename new table
                log.info("Step 4: Renaming Users_new to Users...");
                jdbcTemplate.execute("ALTER TABLE Users_new RENAME TO Users");
                
                log.info("✅ Users table migration completed successfully!");
                log.info("Password field is now VARCHAR(100) and can store BCrypt hashes (60 chars)");
                
            } else if (currentSchema != null && currentSchema.contains("password VARCHAR(100)")) {
                log.info("✅ Users table already has correct password field size (VARCHAR(100)). No migration needed.");
            } else {
                log.warn("Could not determine Users table schema. Current schema: {}", currentSchema);
            }
            
        } catch (Exception e) {
            log.error("❌ Failed to migrate Users table: {}", e.getMessage(), e);
            log.error("CRITICAL: The application may not work correctly. Password field is too small for BCrypt hashes!");
            // Don't throw exception - let the app start so admin can fix manually
        }
        
    }
}
