package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.AlertConfigEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class AlertConfigurationDao {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public AlertConfigurationDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void createTableIfNotExists() {
        String sql = "CREATE TABLE IF NOT EXISTS alert_configuration (" +
                "id INT PRIMARY KEY, " +
                "data_max_age_minutes INT, " +
                "co2_critical DOUBLE, " +
                "co2_warning DOUBLE, " +
                "temp_critical_high DOUBLE, " +
                "temp_critical_low DOUBLE, " +
                "temp_warning_high DOUBLE, " +
                "temp_warning_low DOUBLE, " +
                "humidity_warning_high DOUBLE, " +
                "humidity_warning_low DOUBLE, " +
                "noise_warning DOUBLE" +
                ")";
        jdbcTemplate.execute(sql);
    }

    public AlertConfigEntity load() {
        String sql = "SELECT * FROM alert_configuration WHERE id = 1";
        List<AlertConfigEntity> results = jdbcTemplate.query(sql, new BeanPropertyRowMapper<>(AlertConfigEntity.class));
        return results.isEmpty() ? null : results.get(0);
    }

    public void save(AlertConfigEntity config) {
        // Upsert logic: simple way is check if exists then update, or insert.
        // Or use ON DUPLICATE KEY UPDATE (MySQL) / MERGE (H2).
        // Since we want DB agnostic, explicit check is safer for this singleton.
        // Actually, we can just try update, if 0 rows, then insert.
        
        String updateSql = "UPDATE alert_configuration SET " +
                "data_max_age_minutes = ?, " +
                "co2_critical = ?, co2_warning = ?, " +
                "temp_critical_high = ?, temp_critical_low = ?, temp_warning_high = ?, temp_warning_low = ?, " +
                "humidity_warning_high = ?, humidity_warning_low = ?, " +
                "noise_warning = ? " +
                "WHERE id = 1";

        int rows = jdbcTemplate.update(updateSql,
                config.getDataMaxAgeMinutes(),
                config.getCo2Critical(), config.getCo2Warning(),
                config.getTempCriticalHigh(), config.getTempCriticalLow(), config.getTempWarningHigh(), config.getTempWarningLow(),
                config.getHumidityWarningHigh(), config.getHumidityWarningLow(),
                config.getNoiseWarning());

        if (rows == 0) {
            String insertSql = "INSERT INTO alert_configuration (" +
                    "id, data_max_age_minutes, " +
                    "co2_critical, co2_warning, " +
                    "temp_critical_high, temp_critical_low, temp_warning_high, temp_warning_low, " +
                    "humidity_warning_high, humidity_warning_low, " +
                    "noise_warning) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            jdbcTemplate.update(insertSql,
                    config.getDataMaxAgeMinutes(),
                    config.getCo2Critical(), config.getCo2Warning(),
                    config.getTempCriticalHigh(), config.getTempCriticalLow(), config.getTempWarningHigh(), config.getTempWarningLow(),
                    config.getHumidityWarningHigh(), config.getHumidityWarningLow(),
                    config.getNoiseWarning());
        }
    }
}
