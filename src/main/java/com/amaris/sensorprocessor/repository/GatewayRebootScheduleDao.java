package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class GatewayRebootScheduleDao {

    private final JdbcTemplate jdbcTemplate;

    public GatewayRebootScheduleDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void initializeTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS gateway_reboot_schedule (
                    gateway_id VARCHAR(50) NOT NULL PRIMARY KEY,
                    enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    interval_minutes INT NOT NULL DEFAULT 1440,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    public List<GatewayRebootSchedule> findAll() {
        return jdbcTemplate.query(
                "SELECT gateway_id, enabled, interval_minutes FROM gateway_reboot_schedule ORDER BY LOWER(gateway_id)",
                (rs, rowNum) -> new GatewayRebootSchedule(
                        rs.getString("gateway_id"),
                        rs.getBoolean("enabled"),
                        rs.getInt("interval_minutes")
                )
        );
    }

    public List<GatewayRebootSchedule> findEnabled() {
        return jdbcTemplate.query(
                "SELECT gateway_id, enabled, interval_minutes FROM gateway_reboot_schedule WHERE enabled = TRUE",
                (rs, rowNum) -> new GatewayRebootSchedule(
                        rs.getString("gateway_id"),
                        rs.getBoolean("enabled"),
                        rs.getInt("interval_minutes")
                )
        );
    }

    public Optional<GatewayRebootSchedule> findByGatewayId(String gatewayId) {
        List<GatewayRebootSchedule> schedules = jdbcTemplate.query(
                "SELECT gateway_id, enabled, interval_minutes FROM gateway_reboot_schedule WHERE gateway_id = ?",
                (rs, rowNum) -> new GatewayRebootSchedule(
                        rs.getString("gateway_id"),
                        rs.getBoolean("enabled"),
                        rs.getInt("interval_minutes")
                ),
                gatewayId
        );
        return schedules.isEmpty() ? Optional.empty() : Optional.of(schedules.get(0));
    }

    public void save(GatewayRebootSchedule schedule) {
        int updatedRows = jdbcTemplate.update("""
                UPDATE gateway_reboot_schedule
                SET enabled = ?, interval_minutes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE gateway_id = ?
                """,
                schedule.isEnabled(),
                schedule.getIntervalMinutes(),
                schedule.getGatewayId()
        );

        if (updatedRows > 0) {
            return;
        }

        jdbcTemplate.update("""
                INSERT INTO gateway_reboot_schedule (gateway_id, enabled, interval_minutes)
                VALUES (?, ?, ?)
                """,
                schedule.getGatewayId(),
                schedule.isEnabled(),
                schedule.getIntervalMinutes()
        );
    }
}
