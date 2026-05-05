package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.config.DatabaseMigration;
import com.amaris.sensorprocessor.entity.PendingUser;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class PendingUserDao {


    private static final Logger log = LoggerFactory.getLogger(DatabaseMigration.class);
    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public PendingUserDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        initSchemaIfMissing();
    }

    private static final RowMapper<PendingUser> ROW_MAPPER = (rs, i) -> {
        PendingUser p = new PendingUser();
        p.setEmail(rs.getString("email"));
        p.setUsername(rs.getString("username"));
        p.setFirstname(rs.getString("firstname"));
        p.setLastname(rs.getString("lastname"));
        p.setPassword(rs.getString("password"));
        p.setRole(rs.getString("role"));
        p.setIcon(rs.getString("icon"));
        p.setTokenHash(rs.getString("token_hash"));
        p.setExpiresAt(readInstant(rs, "expires_at"));
        int rc = rs.getInt("resend_count");
        p.setResendCount(rs.wasNull() ? 0 : rc);
        p.setLastResendAt(readInstant(rs, "last_resend_at"));
        return p;
    };

    private void initSchemaIfMissing() {
        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS pending_users (" +
                        "email VARCHAR(100) PRIMARY KEY NOT NULL, " +
                        "username VARCHAR(50) NOT NULL, " +
                        "firstname VARCHAR(50) NOT NULL, " +
                        "lastname VARCHAR(50) NOT NULL, " +
                        "password VARCHAR(100) NOT NULL, " +
                        "role VARCHAR(20) NOT NULL, " +
                        "icon VARCHAR(100) NULL, " +
                        "token_hash VARCHAR(128) NOT NULL, " +
                        "expires_at DATETIME NOT NULL, " +
                        "resend_count INTEGER NOT NULL DEFAULT 0, " +
                        "last_resend_at DATETIME NULL" +
                        ")"
        );
        try {
            // Note: Cette syntaxe fonctionne pour SQLite mais pas pour MySQL
            jdbcTemplate.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_users_token_hash ON pending_users(token_hash)");
        } catch (Exception e) {
            // Ignorer l'index s'il existe déjà
            log.info("Skipping 'idx_pending_users_token_hash' index creation");
        }
    }

    public Optional<PendingUser> findByEmail(String email) {
        List<PendingUser> list = jdbcTemplate.query(
                "SELECT * FROM pending_users WHERE email = ?",
                ROW_MAPPER,
                email
        );
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public Optional<PendingUser> findByTokenHash(String tokenHash) {
        List<PendingUser> list = jdbcTemplate.query(
                "SELECT * FROM pending_users WHERE token_hash = ?",
                ROW_MAPPER,
                tokenHash
        );
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public int insert(PendingUser p) {
        return jdbcTemplate.update(
                "INSERT INTO pending_users (email, username, firstname, lastname, password, role, icon, token_hash, expires_at, resend_count, last_resend_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                p.getEmail(), p.getUsername(), p.getFirstname(), p.getLastname(), p.getPassword(), p.getRole(), p.getIcon(), p.getTokenHash(), toSqlTimestamp(p.getExpiresAt()), p.getResendCount(), toSqlTimestamp(p.getLastResendAt())
        );
    }

    public int updateTokenAndResend(String email, String newTokenHash, Instant expiresAt, int resendCount, Instant lastResendAt) {
        return jdbcTemplate.update(
                "UPDATE pending_users SET token_hash = ?, expires_at = ?, resend_count = ?, last_resend_at = ? WHERE email = ?",
                newTokenHash, toSqlTimestamp(expiresAt), resendCount, toSqlTimestamp(lastResendAt), email
        );
    }

    public int deleteByEmail(String email) {
        return jdbcTemplate.update("DELETE FROM pending_users WHERE email = ?", email);
    }

    public int deleteExpired(Instant now) {
        return jdbcTemplate.update("DELETE FROM pending_users WHERE expires_at < ?", toSqlTimestamp(now));
    }

    private static Timestamp toSqlTimestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant readInstant(ResultSet rs, String columnName) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(columnName);
        if (timestamp != null) {
            return timestamp.toInstant();
        }

        String value = rs.getString(columnName);
        if (value == null || value.isBlank()) {
            return null;
        }
        return Instant.parse(value);
    }
}


