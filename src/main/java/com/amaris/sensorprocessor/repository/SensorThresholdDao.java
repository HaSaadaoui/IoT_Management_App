package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.SensorThreshold;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Repository
public class SensorThresholdDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final RowMapper<SensorThreshold> ROW_MAPPER = new RowMapper<SensorThreshold>() {
        @Override
        public SensorThreshold mapRow(ResultSet rs, int rowNum) throws SQLException {
            SensorThreshold threshold = new SensorThreshold();
            threshold.setId(rs.getLong("id"));
            threshold.setSensorId(rs.getString("sensor_id"));
            threshold.setParameterType(rs.getString("parameter_type"));
            threshold.setWarningThreshold(rs.getDouble("warning_threshold"));
            threshold.setCriticalThreshold(rs.getDouble("critical_threshold"));
            threshold.setWarningLow(rs.getObject("warning_low") != null ? rs.getDouble("warning_low") : null);
            threshold.setCriticalLow(rs.getObject("critical_low") != null ? rs.getDouble("critical_low") : null);
            threshold.setEnabled(rs.getBoolean("enabled"));
            return threshold;
        }
    };

    public void createTableIfNotExists() {
        String sql = """
            CREATE TABLE IF NOT EXISTS sensor_thresholds (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                sensor_id VARCHAR(255) NOT NULL,
                parameter_type VARCHAR(50) NOT NULL,
                warning_threshold DOUBLE,
                critical_threshold DOUBLE,
                warning_low DOUBLE,
                critical_low DOUBLE,
                enabled TINYINT DEFAULT 1,
                UNIQUE KEY unique_sensor_param (sensor_id, parameter_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """;
        jdbcTemplate.execute(sql);
    }

    public List<SensorThreshold> findBySensorId(String sensorId) {
        String sql = "SELECT * FROM sensor_thresholds WHERE sensor_id = ? AND enabled = 1";
        return jdbcTemplate.query(sql, ROW_MAPPER, sensorId);
    }

    public Optional<SensorThreshold> findBySensorAndParameter(String sensorId, String parameterType) {
        String sql = "SELECT * FROM sensor_thresholds WHERE sensor_id = ? AND parameter_type = ?";
        List<SensorThreshold> results = jdbcTemplate.query(sql, ROW_MAPPER, sensorId, parameterType);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public List<SensorThreshold> findAll() {
        String sql = "SELECT * FROM sensor_thresholds WHERE enabled = 1";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public Optional<SensorThreshold> findById(String id) {
        String sql = "SELECT * FROM sensor_thresholds WHERE id = ?";
        List<SensorThreshold> results = jdbcTemplate.query(sql, ROW_MAPPER, id);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public void delete(String id) {
        String sql = "DELETE FROM sensor_thresholds WHERE id = ?";
        jdbcTemplate.update(sql, id);
    }

    public void save(SensorThreshold threshold) {
        String sql = """
            INSERT INTO sensor_thresholds 
            (id, sensor_id, parameter_type, warning_threshold, critical_threshold, warning_low, critical_low, enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            warning_threshold = VALUES(warning_threshold),
            critical_threshold = VALUES(critical_threshold),
            warning_low = VALUES(warning_low),
            critical_low = VALUES(critical_low),
            enabled = VALUES(enabled)
        """;
        jdbcTemplate.update(sql,
                threshold.getId(),
                threshold.getSensorId(),
                threshold.getParameterType(),
                threshold.getWarningThreshold(),
                threshold.getCriticalThreshold(),
                threshold.getWarningLow(),
                threshold.getCriticalLow(),
                threshold.isEnabled() ? 1 : 0
        );
    }

    public void delete(Long id) {
        String sql = "DELETE FROM sensor_thresholds WHERE id = ?";
        jdbcTemplate.update(sql, id);
    }
}
