package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalTime;
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
                day_of_week INT NOT NULL DEFAULT 1,
                reboot_time VARCHAR(5) NOT NULL DEFAULT '00:00',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """);

        // Migration : ajout des nouvelles colonnes si elles n'existent pas encore
        migrateColumnIfAbsent("day_of_week", "ADD COLUMN day_of_week INT NOT NULL DEFAULT 1");
        migrateColumnIfAbsent("reboot_time", "ADD COLUMN reboot_time VARCHAR(5) NOT NULL DEFAULT '00:00'");
        migrateColumnIfAbsent("_drop_interval", "DROP COLUMN interval_minutes");
    }

    private void migrateColumnIfAbsent(String marker, String alterClause) {
        try {
            // On tente une requête légère pour détecter la présence/absence de la colonne
            if (marker.startsWith("_drop_")) {
                // Tenter de lire interval_minutes : si ça passe, la colonne existe encore → on la supprime
                jdbcTemplate.execute("SELECT interval_minutes FROM gateway_reboot_schedule LIMIT 1");
                jdbcTemplate.execute("ALTER TABLE gateway_reboot_schedule " + alterClause);
            } else {
                jdbcTemplate.execute("SELECT " + marker + " FROM gateway_reboot_schedule LIMIT 1");
                // Colonne déjà présente, rien à faire
            }
        } catch (Exception e) {
            if (marker.startsWith("_drop_")) {
                // interval_minutes n'existe déjà plus, ok
            } else {
                // Colonne absente → on l'ajoute
                jdbcTemplate.execute("ALTER TABLE gateway_reboot_schedule " + alterClause);
            }
        }
    }

    private GatewayRebootSchedule mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new GatewayRebootSchedule(
                rs.getString("gateway_id"),
                rs.getBoolean("enabled"),
                rs.getInt("day_of_week"),
                LocalTime.parse(rs.getString("reboot_time"))
        );
    }

    public List<GatewayRebootSchedule> findAll() {
        return jdbcTemplate.query(
                "SELECT gateway_id, enabled, day_of_week, reboot_time FROM gateway_reboot_schedule ORDER BY LOWER(gateway_id)",
                this::mapRow
        );
    }

    public List<GatewayRebootSchedule> findEnabled() {
        return jdbcTemplate.query(
                "SELECT gateway_id, enabled, day_of_week, reboot_time FROM gateway_reboot_schedule WHERE enabled = TRUE",
                this::mapRow
        );
    }

    public Optional<GatewayRebootSchedule> findByGatewayId(String gatewayId) {
        List<GatewayRebootSchedule> schedules = jdbcTemplate.query(
                "SELECT gateway_id, enabled, day_of_week, reboot_time FROM gateway_reboot_schedule WHERE gateway_id = ?",
                this::mapRow,
                gatewayId
        );
        return schedules.isEmpty() ? Optional.empty() : Optional.of(schedules.get(0));
    }

    public void save(GatewayRebootSchedule schedule) {
        int updatedRows = jdbcTemplate.update("""
                UPDATE gateway_reboot_schedule
                SET enabled = ?, day_of_week = ?, reboot_time = ?, updated_at = CURRENT_TIMESTAMP
                WHERE gateway_id = ?
                """,
                schedule.isEnabled(),
                schedule.getDayOfWeek(),
                schedule.getRebootTime().toString(),
                schedule.getGatewayId()
        );

        if (updatedRows > 0) {
            return;
        }

        jdbcTemplate.update("""
                INSERT INTO gateway_reboot_schedule (gateway_id, enabled, day_of_week, reboot_time)
                VALUES (?, ?, ?, ?)
                """,
                schedule.getGatewayId(),
                schedule.isEnabled(),
                schedule.getDayOfWeek(),
                schedule.getRebootTime().toString()
        );
    }
}