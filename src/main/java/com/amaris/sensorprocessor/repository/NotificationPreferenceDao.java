package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.NotificationPreference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Repository
public class NotificationPreferenceDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final RowMapper<NotificationPreference> ROW_MAPPER = new RowMapper<NotificationPreference>() {
        @Override
        public NotificationPreference mapRow(ResultSet rs, int rowNum) throws SQLException {
            NotificationPreference pref = new NotificationPreference();
            pref.setId(rs.getLong("id"));
            pref.setUsername(rs.getString("username"));
            pref.setParameterType(rs.getString("parameter_type"));
            pref.setEmailEnabled(rs.getBoolean("email_enabled"));
            pref.setSmsEnabled(rs.getBoolean("sms_enabled"));
            pref.setCustomEmail(rs.getString("custom_email"));
            pref.setCustomPhone(rs.getString("custom_phone"));
            return pref;
        }
    };

    public void createTableIfNotExists() {
        String sql = """
            CREATE TABLE IF NOT EXISTS notification_preferences (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                parameter_type VARCHAR(50) NOT NULL,
                email_enabled TINYINT DEFAULT 1,
                sms_enabled TINYINT DEFAULT 0,
                custom_email VARCHAR(255),
                custom_phone VARCHAR(50),
                UNIQUE KEY unique_user_param (username, parameter_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """;
        jdbcTemplate.execute(sql);
    }

    public List<NotificationPreference> findByUsername(String username) {
        String sql = "SELECT * FROM notification_preferences WHERE username = ?";
        return jdbcTemplate.query(sql, ROW_MAPPER, username);
    }

    public Optional<NotificationPreference> findByUsernameAndParameter(String username, String parameterType) {
        String sql = "SELECT * FROM notification_preferences WHERE username = ? AND parameter_type = ?";
        List<NotificationPreference> results = jdbcTemplate.query(sql, ROW_MAPPER, username, parameterType);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public void save(NotificationPreference preference) {
        String sql = """
            INSERT INTO notification_preferences 
            (id, username, parameter_type, email_enabled, sms_enabled, custom_email, custom_phone)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            email_enabled = VALUES(email_enabled),
            sms_enabled = VALUES(sms_enabled),
            custom_email = VALUES(custom_email),
            custom_phone = VALUES(custom_phone)
        """;
        jdbcTemplate.update(sql,
                preference.getId(),
                preference.getUsername(),
                preference.getParameterType(),
                preference.isEmailEnabled() ? 1 : 0,
                preference.isSmsEnabled() ? 1 : 0,
                preference.getCustomEmail(),
                preference.getCustomPhone()
        );
    }

    public Optional<NotificationPreference> findById(String id) {
        String sql = "SELECT * FROM notification_preferences WHERE id = ?";
        List<NotificationPreference> results = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public void delete(String id) {
        String sql = "DELETE FROM notification_preferences WHERE id = ?";
        jdbcTemplate.update(sql, id);
    }
}
