package com.amaris.sensorprocessor.repository;

import lombok.AllArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.time.Instant;
import java.time.LocalDateTime;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.SensorData;
@AllArgsConstructor
@Repository
public class SensorDataDao {
    private final JdbcTemplate jdbcTemplate;

    public int insertSensorData(SensorData sensorData) {
        return jdbcTemplate.update(
            "INSERT INTO sensor_data (id_sensor, received_at, string_value, value_type) VALUES (?, ?, ?, ?)",
            sensorData.getIdSensor(),
            sensorData.getReceivedAt(),
            sensorData.getAsString(),
            sensorData.getValueType().toString()
        );
    }

    // sql_mode=only_full_group_by doit etre activé sur le serveur MySQL

    public HashMap<PayloadValueType, SensorData> findLatestDataBySensor(String idSensor) {
        int limit = 1000;
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? GROUP BY value_type ORDER BY received_at DESC, value_type, id_sensor LIMIT ?";
        var result = jdbcTemplate.query(query, (rs, rowNum) -> {
            SensorData sensorData = new SensorData(
                rs.getString("id_sensor"),
                rs.getTimestamp("received_at").toLocalDateTime(),
                rs.getString("string_value"),
                rs.getString("value_type")
            );
            return sensorData;
        }, idSensor, limit);
        
        HashMap<PayloadValueType, SensorData> datas = new HashMap<>();
        for (SensorData sensorData : result) {
            datas.put(sensorData.getValueType(), sensorData);
        }
        return datas;
    }

    public List<SensorData> findSensorDataByPeriodAndType(String idSensor, Date startDate, Date endDate, PayloadValueType valueType, Optional<Integer> limit) {
        StringBuilder queryBuilder = new StringBuilder("SELECT * FROM sensor_data WHERE id_sensor = ? AND value_type = ? AND received_at BETWEEN ? AND ?");
        List<Object> params = new ArrayList<>();
        params.add(idSensor);
        params.add(valueType.toString());
        params.add(startDate);
        params.add(endDate);

        if (limit.isPresent() && limit.get() > 0) {
            // To get the N most recent records in ascending time order,
            // we order by DESC and limit, then reverse the list in Java.
            queryBuilder.append(" ORDER BY received_at DESC LIMIT ?");
            params.add(limit.get());
        } else {
            queryBuilder.append(" ORDER BY received_at ASC");
        }

        try {
            List<SensorData> result = jdbcTemplate.query(queryBuilder.toString(), (rs, rowNum) -> {
                SensorData sensorData = new SensorData(
                    rs.getString("id_sensor"),
                    rs.getTimestamp("received_at").toLocalDateTime(),
                    rs.getString("string_value"),
                    rs.getString("value_type")
                );
                return sensorData;
            }, params.toArray());

            if (limit.isPresent() && limit.get() > 0) {
                // Reverse the list to get ascending chronological order if a limit was applied
                java.util.Collections.reverse(result);
            }
            return result;
        } catch (Exception e) {
            // Log the exception if necessary
            return new ArrayList<>();
        }
    }

    public List<SensorData> findSensorDataByPeriod(String idSensor, Date startDate, Date endDate) {
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? AND received_at BETWEEN ? AND ? ORDER BY received_at ASC";

        try {
            return jdbcTemplate.query(query, (rs, rowNum) -> {
                SensorData sensorData = new SensorData(
                    rs.getString("id_sensor"),
                    rs.getTimestamp("received_at").toLocalDateTime(),
                    rs.getString("string_value"),
                    rs.getString("value_type")
                );
                return sensorData;
            }, idSensor, startDate, endDate);
        } catch (Exception e) {
            // Log the exception if necessary
            return new ArrayList<>();
        }
    }

    // TODO: refactor and rename
    public List<SensorData> findSensorDataByPeriodAndTypes2(String idSensor, Date startDate, Date endDate, Set<PayloadValueType> valueType) {
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? AND value_type IN (" +
            String.join(",", valueType.stream().map(type -> "'" + type.toString() + "'").toList()) +
            ") AND received_at BETWEEN ? AND ? ORDER BY received_at ASC";

        try {
            return jdbcTemplate.query(query, (rs, rowNum) -> {
                SensorData sensorData = new SensorData(
                    rs.getString("id_sensor"),
                    rs.getTimestamp("received_at").toLocalDateTime(),
                    rs.getString("string_value"),
                    rs.getString("value_type")
                );
                return sensorData;
            }, idSensor, startDate, endDate);
        } catch (Exception e) {
            // Log the exception if necessary
            return new ArrayList<>();
        }
        
    }

    public Optional<SensorData> findLatestBySensorAndType(String idSensor, PayloadValueType valueType) {
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? AND value_type = ? ORDER BY received_at DESC LIMIT 1";

        try {
            List<SensorData> result = jdbcTemplate.query(query, (rs, rowNum) -> {
                LocalDateTime receivedAt = rs.getTimestamp("received_at") != null ? rs.getTimestamp("received_at").toLocalDateTime() : null;
                String stringValue = rs.getString("string_value");
                String vt = rs.getString("value_type");

                if (receivedAt == null || stringValue == null || vt == null) {
                    return null; // Skip invalid records
                }

                return new SensorData(rs.getString("id_sensor"), receivedAt, stringValue, vt);
            }, idSensor, valueType.toString());

            return result.stream().filter(java.util.Objects::nonNull).findFirst();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public Optional<SensorData> findLatestBySensor(String idSensor) {
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? ORDER BY received_at DESC LIMIT 1";

        try {
            List<SensorData> result = jdbcTemplate.query(query, (rs, rowNum) -> {
                LocalDateTime receivedAt = rs.getTimestamp("received_at") != null ? rs.getTimestamp("received_at").toLocalDateTime() : null;
                String stringValue = rs.getString("string_value");
                String vt = rs.getString("value_type");

                if (receivedAt == null || stringValue == null || vt == null) {
                    return null; // Skip invalid records
                }

                return new SensorData(rs.getString("id_sensor"), receivedAt, stringValue, vt);
            }, idSensor);

            return result.stream().filter(java.util.Objects::nonNull).findFirst();
        } catch (Exception e) {
            // Log the exception if necessary
            return Optional.empty();
        }
    }

    public Optional<SensorData> findLastValueBefore(String idSensor, PayloadValueType channel, Instant instant) {
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? AND value_type = ? AND received_at < ? ORDER BY received_at DESC LIMIT 1";

        try {
            List<SensorData> result = jdbcTemplate.query(query, (rs, rowNum) -> {
                LocalDateTime receivedAt = rs.getTimestamp("received_at") != null ? rs.getTimestamp("received_at").toLocalDateTime() : null;
                String stringValue = rs.getString("string_value");
                String valueType = rs.getString("value_type");

                if (receivedAt == null || stringValue == null || valueType == null) {
                    return null; // Skip invalid records
                }

                return new SensorData(rs.getString("id_sensor"), receivedAt, stringValue, valueType);
            }, idSensor, channel.toString(), instant);

            return result.stream().filter(java.util.Objects::nonNull).findFirst();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Get the average value of a specific sensor and valueType during a given hour.
     * This is useful for computing histograms with hourly granularity.
     *
     * @param sensorId The sensor ID to query
     * @param valueType The metric type (e.g., OCCUPANCY, TEMPERATURE, etc.)
     * @param hourStart The start of the hour (e.g., "2025-12-03 14:00:00")
     * @param hourEnd The end of the hour (e.g., "2025-12-03 14:59:59")
     * @return Optional containing the average value, or empty if no data exists
     */
    public Optional<Double> getAverageValueForHour(
            String sensorId,
            PayloadValueType valueType,
            LocalDateTime hourStart,
            LocalDateTime hourEnd) {

        String query = "SELECT AVG(CAST(string_value AS REAL)) as avg_value " +
                      "FROM sensor_data " +
                      "WHERE id_sensor = ? " +
                      "  AND value_type = ? " +
                      "  AND received_at >= ? " +
                      "  AND received_at < ? " +
                      "  AND string_value IS NOT NULL";

        try {
            Double avgValue = jdbcTemplate.queryForObject(
                query,
                Double.class,
                sensorId,
                valueType.toString(),
                hourStart,
                hourEnd
            );

            return Optional.ofNullable(avgValue);
        } catch (Exception e) {
            // No data found or error occurred
            return Optional.empty();
        }
    }

    /**
     * Get the average value of a specific sensor and valueType during a given hour.
     * Convenience method that takes Date objects instead of LocalDateTime.
     *
     * @param sensorId The sensor ID to query
     * @param valueType The metric type
     * @param hourStart The start of the hour
     * @param hourEnd The end of the hour
     * @return Optional containing the average value, or empty if no data exists
     */
    public Optional<Double> getAverageValueForHour(
            String sensorId,
            PayloadValueType valueType,
            Date hourStart,
            Date hourEnd) {

        String query = "SELECT AVG(CAST(string_value AS REAL)) as avg_value " +
                      "FROM sensor_data " +
                      "WHERE id_sensor = ? " +
                      "  AND value_type = ? " +
                      "  AND received_at >= ? " +
                      "  AND received_at < ? " +
                      "  AND string_value IS NOT NULL";

        try {
            Double avgValue = jdbcTemplate.queryForObject(
                query,
                Double.class,
                sensorId,
                valueType.toString(),
                hourStart,
                hourEnd
            );

            return Optional.ofNullable(avgValue);
        } catch (Exception e) {
            // No data found or error occurred
            return Optional.empty();
        }
    }

    /**
     * Get detailed statistics for a specific sensor and valueType during a given hour.
     * Returns average, min, max, and count for more comprehensive histogram data.
     *
     * @param sensorId The sensor ID to query
     * @param valueType The metric type
     * @param hourStart The start of the hour
     * @param hourEnd The end of the hour
     * @return Optional containing hourly statistics, or empty if no data exists
     */
    public Optional<HourlyStatistics> getHourlyStatistics(
            String sensorId,
            PayloadValueType valueType,
            LocalDateTime hourStart,
            LocalDateTime hourEnd) {

        String query = "SELECT " +
                      "  AVG(CAST(string_value AS REAL)) as avg_value, " +
                      "  MIN(CAST(string_value AS REAL)) as min_value, " +
                      "  MAX(CAST(string_value AS REAL)) as max_value, " +
                      "  COUNT(*) as data_count " +
                      "FROM sensor_data " +
                      "WHERE id_sensor = ? " +
                      "  AND value_type = ? " +
                      "  AND received_at >= ? " +
                      "  AND received_at < ? " +
                      "  AND string_value IS NOT NULL";

        try {
            HourlyStatistics result = jdbcTemplate.queryForObject(query, (rs, rowNum) -> {
                int count = rs.getInt("data_count");
                if (count == 0) {
                    return null;
                }
                return new HourlyStatistics(
                    rs.getDouble("avg_value"),
                    rs.getDouble("min_value"),
                    rs.getDouble("max_value"),
                    count
                );
            }, sensorId, valueType.toString(), hourStart, hourEnd);

            return Optional.ofNullable(result);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Get detailed statistics for MULTIPLE sensors during a given hour.
     * This batches the query to reduce database round trips.
     *
     * @param sensorIds List of sensor IDs to query
     * @param valueType The metric type
     * @param hourStart The start of the hour
     * @param hourEnd The end of the hour
     * @return Map of sensor ID to hourly statistics
     */
    public Map<String, HourlyStatistics> getHourlyStatisticsBatch(
            List<String> sensorIds,
            PayloadValueType valueType,
            LocalDateTime hourStart,
            LocalDateTime hourEnd) {

        if (sensorIds == null || sensorIds.isEmpty()) {
            return new HashMap<>();
        }

        String placeholders = String.join(",", java.util.Collections.nCopies(sensorIds.size(), "?"));

        // Query all sensors at once, grouped by sensor
        String query = "SELECT " +
                      "  id_sensor, " +
                      "  AVG(CAST(string_value AS REAL)) as avg_value, " +
                      "  MIN(CAST(string_value AS REAL)) as min_value, " +
                      "  MAX(CAST(string_value AS REAL)) as max_value, " +
                      "  COUNT(*) as data_count " +
                      "FROM sensor_data " +
                      "WHERE id_sensor IN (" + placeholders + ") " +
                      "  AND value_type = ? " +
                      "  AND received_at >= ? " +
                      "  AND received_at < ? " +
                      "  AND string_value IS NOT NULL " +
                      "GROUP BY id_sensor";

        List<Object> params = new ArrayList<>(sensorIds.size() + 3);
        params.addAll(sensorIds);
        params.add(valueType.toString());
        params.add(hourStart);
        params.add(hourEnd);

        try {
            List<Map.Entry<String, HourlyStatistics>> results = jdbcTemplate.query(query, (rs, rowNum) -> {
                int count = rs.getInt("data_count");
                if (count == 0) {
                    return null;
                }

                String sensorId = rs.getString("id_sensor");
                HourlyStatistics stats = new HourlyStatistics(
                    rs.getDouble("avg_value"),
                    rs.getDouble("min_value"),
                    rs.getDouble("max_value"),
                    count
                );

                return Map.entry(sensorId, stats);
            }, params.toArray());

            // Convert list to map, filtering out nulls
            Map<String, HourlyStatistics> resultMap = new HashMap<>();
            for (Map.Entry<String, HourlyStatistics> entry : results) {
                if (entry != null) {
                    resultMap.put(entry.getKey(), entry.getValue());
                }
            }

            return resultMap;
        } catch (Exception e) {
            System.err.println("Error executing batch hourly statistics: " + e.getMessage());
            return new HashMap<>();
        }
    }

    /**
     * Get detailed statistics for MULTIPLE sensors during a given DAY.
     * This reduces queries even further by aggregating at the daily level.
     *
     * @param sensorIds List of sensor IDs to query
     * @param valueType The metric type
     * @param dayStart The start of the day (e.g., "2025-12-03 00:00:00")
     * @param dayEnd The end of the day (e.g., "2025-12-04 00:00:00")
     * @return Map of sensor ID to daily statistics
     */
    public Map<String, HourlyStatistics> getDailyStatisticsBatch(
            List<String> sensorIds,
            PayloadValueType valueType,
            LocalDateTime dayStart,
            LocalDateTime dayEnd) {

        if (sensorIds == null || sensorIds.isEmpty()) {
            return new HashMap<>();
        }

        String placeholders = String.join(",", java.util.Collections.nCopies(sensorIds.size(), "?"));

        // Query all sensors at once for the entire day, grouped by sensor
        String query = "SELECT " +
                      "  id_sensor, " +
                      "  AVG(CAST(string_value AS REAL)) as avg_value, " +
                      "  MIN(CAST(string_value AS REAL)) as min_value, " +
                      "  MAX(CAST(string_value AS REAL)) as max_value, " +
                      "  COUNT(*) as data_count " +
                      "FROM sensor_data " +
                      "WHERE id_sensor IN (" + placeholders + ") " +
                      "  AND value_type = ? " +
                      "  AND received_at >= ? " +
                      "  AND received_at < ? " +
                      "  AND string_value IS NOT NULL " +
                      "GROUP BY id_sensor";

        List<Object> params = new ArrayList<>(sensorIds.size() + 3);
        params.addAll(sensorIds);
        params.add(valueType.toString());
        params.add(dayStart);
        params.add(dayEnd);

        try {
            List<Map.Entry<String, HourlyStatistics>> results = jdbcTemplate.query(query, (rs, rowNum) -> {
                int count = rs.getInt("data_count");
                if (count == 0) {
                    return null;
                }

                String sensorId = rs.getString("id_sensor");
                HourlyStatistics stats = new HourlyStatistics(
                    rs.getDouble("avg_value"),
                    rs.getDouble("min_value"),
                    rs.getDouble("max_value"),
                    count
                );

                return Map.entry(sensorId, stats);
            }, params.toArray());

            // Convert list to map, filtering out nulls
            Map<String, HourlyStatistics> resultMap = new HashMap<>();
            for (Map.Entry<String, HourlyStatistics> entry : results) {
                if (entry != null) {
                    resultMap.put(entry.getKey(), entry.getValue());
                }
            }

            return resultMap;
        } catch (Exception e) {
            System.err.println("Error executing batch daily statistics: " + e.getMessage());
            return new HashMap<>();
        }
    }

    /**
     * DTO for hourly statistics.
     */
    public static class HourlyStatistics {
        private final double average;
        private final double min;
        private final double max;
        private final int dataPointCount;

        public HourlyStatistics(double average, double min, double max, int dataPointCount) {
            this.average = average;
            this.min = min;
            this.max = max;
            this.dataPointCount = dataPointCount;
        }

        public double getAverage() { return average; }
        public double getMin() { return min; }
        public double getMax() { return max; }
        public int getDataPointCount() { return dataPointCount; }
    }

    /**
     * Find aggregated data by period and type with hourly binning.
     * This method aggregates sensor data by hour for memory efficiency.
     *
     * @param sensorIds List of sensor IDs
     * @param startDate Start date
     * @param endDate End date
     * @param valueType Value type to aggregate
     * @param aggregationType Aggregation type (AVG, SUM, MAX, MIN, COUNT)
     * @return List of aggregated data points
     */
    public List<AggregatedDataPoint> findAggregatedDataByPeriodAndType(
            List<String> sensorIds,
            Date startDate,
            Date endDate,
            PayloadValueType valueType,
            String aggregationType) {

        if (sensorIds == null || sensorIds.isEmpty()) {
            return new ArrayList<>();
        }

        String placeholders = String.join(",", java.util.Collections.nCopies(sensorIds.size(), "?"));

        // Bin by hour
        String hourBucket = "strftime('%Y-%m-%d %H:00:00', received_at)";

        // Map aggregation type
        String aggFunc = switch (aggregationType.toUpperCase()) {
            case "AVG", "AVERAGE" -> "AVG";
            case "SUM" -> "SUM";
            case "COUNT" -> "COUNT";
            case "MAX" -> "MAX";
            case "MIN" -> "MIN";
            default -> "AVG";
        };

        String query = "SELECT " +
                      hourBucket + " as time_bucket, " +
                      aggFunc + "(CAST(string_value AS REAL)) as agg_value, " +
                      "COUNT(*) as data_point_count, " +
                      "COUNT(DISTINCT id_sensor) as sensor_count " +
                      "FROM sensor_data " +
                      "WHERE id_sensor IN (" + placeholders + ") " +
                      "  AND received_at BETWEEN ? AND ? " +
                      "  AND value_type = ? " +
                      "  AND string_value IS NOT NULL " +
                      "GROUP BY time_bucket " +
                      "ORDER BY time_bucket ASC";

        List<Object> params = new ArrayList<>(sensorIds.size() + 3);
        params.addAll(sensorIds);
        params.add(startDate);
        params.add(endDate);
        params.add(valueType.toString());

        try {
            return jdbcTemplate.query(query, (rs, rowNum) -> {
                return new AggregatedDataPoint(
                    rs.getString("time_bucket"),
                    rs.getDouble("agg_value"),
                    rs.getInt("sensor_count"),
                    rs.getInt("data_point_count")
                );
            }, params.toArray());
        } catch (Exception e) {
            System.err.println("Error executing aggregation: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * DTO for aggregated data points.
     */
    public static class AggregatedDataPoint {
        private final String timeBucket;
        private final double aggregatedValue;
        private final int sensorCount;
        private final int dataPointCount;

        public AggregatedDataPoint(String timeBucket, double aggregatedValue, int sensorCount, int dataPointCount) {
            this.timeBucket = timeBucket;
            this.aggregatedValue = aggregatedValue;
            this.sensorCount = sensorCount;
            this.dataPointCount = dataPointCount;
        }

        public String getTimeBucket() { return timeBucket; }
        public double getAggregatedValue() { return aggregatedValue; }
        public int getSensorCount() { return sensorCount; }
        public int getDataPointCount() { return dataPointCount; }
    }

}
