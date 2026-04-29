package com.amaris.sensorprocessor.repository;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
@Slf4j
public class DashboardOccupancyDailyAggregateDao {

    private final JdbcTemplate jdbcTemplate;

    public DashboardOccupancyDailyAggregateDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        createTableIfNotExists();
    }

    private void createTableIfNotExists() {
        String sql = """
            CREATE TABLE IF NOT EXISTS dashboard_occupancy_daily_aggregate (
                aggregate_date DATE NOT NULL,
                sensor_id VARCHAR(191) NOT NULL,
                occupied_intervals INT NOT NULL,
                total_intervals INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (aggregate_date, sensor_id),
                INDEX idx_dashboard_occupancy_daily_sensor_date (sensor_id, aggregate_date)
            )
        """;
        jdbcTemplate.execute(sql);
    }

    public Map<LocalDate, Map<String, DailyOccupancyAggregate>> findBySensorIdsAndDateRange(
            List<String> sensorIds,
            LocalDate startDate,
            LocalDate endDate) {

        Map<LocalDate, Map<String, DailyOccupancyAggregate>> result = new LinkedHashMap<>();
        if (sensorIds == null || sensorIds.isEmpty() || startDate == null || endDate == null || endDate.isBefore(startDate)) {
            return result;
        }

        String placeholders = String.join(",", java.util.Collections.nCopies(sensorIds.size(), "?"));
        String sql = """
            SELECT aggregate_date, sensor_id, occupied_intervals, total_intervals
            FROM dashboard_occupancy_daily_aggregate
            WHERE sensor_id IN (%s)
              AND aggregate_date BETWEEN ? AND ?
            ORDER BY aggregate_date, sensor_id
        """.formatted(placeholders);

        List<Object> params = new ArrayList<>(sensorIds.size() + 2);
        params.addAll(sensorIds);
        params.add(Date.valueOf(startDate));
        params.add(Date.valueOf(endDate));

        jdbcTemplate.query(sql, rs -> {
            LocalDate day = rs.getDate("aggregate_date").toLocalDate();
            String sensorId = rs.getString("sensor_id");
            DailyOccupancyAggregate aggregate = new DailyOccupancyAggregate(
                    rs.getInt("occupied_intervals"),
                    rs.getInt("total_intervals")
            );
            result.computeIfAbsent(day, ignored -> new LinkedHashMap<>()).put(sensorId, aggregate);
        }, params.toArray());

        return result;
    }

    public void upsertDailyAggregates(LocalDate day, Map<String, DailyOccupancyAggregate> aggregatesBySensor) {
        if (day == null || aggregatesBySensor == null || aggregatesBySensor.isEmpty()) {
            return;
        }

        List<Map.Entry<String, DailyOccupancyAggregate>> entries = new ArrayList<>(aggregatesBySensor.entrySet());
        String sql = """
            INSERT INTO dashboard_occupancy_daily_aggregate (
                aggregate_date,
                sensor_id,
                occupied_intervals,
                total_intervals
            ) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                occupied_intervals = VALUES(occupied_intervals),
                total_intervals = VALUES(total_intervals),
                updated_at = CURRENT_TIMESTAMP
        """;

        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                Map.Entry<String, DailyOccupancyAggregate> entry = entries.get(i);
                ps.setDate(1, Date.valueOf(day));
                ps.setString(2, entry.getKey());
                ps.setInt(3, entry.getValue().occupiedIntervals());
                ps.setInt(4, entry.getValue().totalIntervals());
            }

            @Override
            public int getBatchSize() {
                return entries.size();
            }
        });

        log.info("[occupancy-cache] saved day {} (rows={})", day, entries.size());
    }

    public OccupancyCacheStatus getCacheStatus() {
        return jdbcTemplate.query("""
                SELECT
                    MIN(aggregate_date) AS first_cached_date,
                    MAX(aggregate_date) AS last_cached_date,
                    COUNT(DISTINCT aggregate_date) AS cached_days,
                    COUNT(*) AS cached_rows
                FROM dashboard_occupancy_daily_aggregate
                """,
                rs -> {
                    if (!rs.next()) {
                        return new OccupancyCacheStatus(null, null, 0, 0);
                    }

                    Date firstCachedDate = rs.getDate("first_cached_date");
                    Date lastCachedDate = rs.getDate("last_cached_date");

                    return new OccupancyCacheStatus(
                            firstCachedDate == null ? null : firstCachedDate.toLocalDate(),
                            lastCachedDate == null ? null : lastCachedDate.toLocalDate(),
                            rs.getInt("cached_days"),
                            rs.getInt("cached_rows")
                    );
                });
    }

    public record DailyOccupancyAggregate(int occupiedIntervals, int totalIntervals) {
    }

    public record OccupancyCacheStatus(
            LocalDate firstCachedDate,
            LocalDate lastCachedDate,
            int cachedDays,
            int cachedRows
    ) {
    }
}
