package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.GatewayData;
import com.amaris.sensorprocessor.entity.GatewayValueType;
import lombok.AllArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@AllArgsConstructor
@Repository
public class GatewayDataDao {

    private final JdbcTemplate jdbcTemplate;

    public int insertGatewayData(GatewayData gatewayData) {
        return jdbcTemplate.update(
                "INSERT INTO gateway_data (id_gateway, received_at, `value`, value_type) VALUES (?, ?, ?, ?)",
                gatewayData.getIdGateway(),
                gatewayData.getReceivedAt(),
                gatewayData.getAsString(),
                gatewayData.getValueType().toString()
        );
    }

    public Map<GatewayValueType, GatewayData> findLatestDataByGateway(String idGateway) {
        String query = """
            SELECT gd.*
            FROM gateway_data gd
            JOIN (
                SELECT value_type, MAX(received_at) AS max_received_at
                FROM gateway_data
                WHERE id_gateway = ?
                GROUP BY value_type
            ) latest
              ON gd.value_type = latest.value_type
             AND gd.received_at = latest.max_received_at
            WHERE gd.id_gateway = ?
            ORDER BY gd.value_type
            """;

        try {
            List<GatewayData> rows = jdbcTemplate.query(query, (rs, rowNum) -> mapRow(rs), idGateway, idGateway);
            Map<GatewayValueType, GatewayData> result = new HashMap<>();
            for (GatewayData row : rows) {
                result.put(row.getValueType(), row);
            }
            return result;
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    public Optional<GatewayData> findLatestByGatewayAndType(String idGateway, GatewayValueType valueType) {
        String query = "SELECT * FROM gateway_data WHERE id_gateway = ? AND value_type = ? ORDER BY received_at DESC LIMIT 1";

        try {
            List<GatewayData> result = jdbcTemplate.query(query, (rs, rowNum) -> mapRow(rs), idGateway, valueType.toString());
            return result.stream().findFirst();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public Optional<GatewayData> findLatestByGateway(String idGateway) {
        String query = "SELECT * FROM gateway_data WHERE id_gateway = ? ORDER BY received_at DESC LIMIT 1";

        try {
            List<GatewayData> result = jdbcTemplate.query(query, (rs, rowNum) -> mapRow(rs), idGateway);
            return result.stream().findFirst();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public List<GatewayData> findGatewayDataByPeriodAndType(
            String idGateway,
            Date startDate,
            Date endDate,
            GatewayValueType valueType,
            Optional<Integer> limit
    ) {
        StringBuilder queryBuilder = new StringBuilder(
                "SELECT * FROM gateway_data WHERE id_gateway = ? AND value_type = ? AND received_at BETWEEN ? AND ?"
        );
        List<Object> params = new ArrayList<>();
        params.add(idGateway);
        params.add(valueType.toString());
        params.add(ts(startDate));
        params.add(ts(endDate));

        if (limit.isPresent() && limit.get() > 0) {
            queryBuilder.append(" ORDER BY received_at DESC LIMIT ?");
            params.add(limit.get());
        } else {
            queryBuilder.append(" ORDER BY received_at ASC");
        }

        try {
            List<GatewayData> result = jdbcTemplate.query(queryBuilder.toString(), (rs, rowNum) -> mapRow(rs), params.toArray());
            if (limit.isPresent() && limit.get() > 0) {
                java.util.Collections.reverse(result);
            }
            return result;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public List<GatewayData> findGatewayDataByPeriod(String idGateway, Date startDate, Date endDate) {
        String query = "SELECT * FROM gateway_data WHERE id_gateway = ? AND received_at BETWEEN ? AND ? ORDER BY received_at ASC";
        try {
            return jdbcTemplate.query(query, (rs, rowNum) -> mapRow(rs), idGateway, ts(startDate), ts(endDate));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public Map<String, Double> getHourlyAverageByType(
            String idGateway,
            GatewayValueType valueType,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime
    ) {
        String query = """
            SELECT DATE_FORMAT(received_at, '%Y-%m-%d %H:00:00') AS time_bucket,
                   AVG(CAST(`value` AS DECIMAL(18, 8))) AS avg_value
            FROM gateway_data
            WHERE id_gateway = ?
              AND value_type = ?
              AND received_at >= ?
              AND received_at < ?
              AND `value` REGEXP '^-?[0-9]+(\\.[0-9]+)?$'
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
            """;

        try {
            Map<String, Double> result = new LinkedHashMap<>();
            RowCallbackHandler handler = rs -> result.put(rs.getString("time_bucket"), rs.getDouble("avg_value"));
            jdbcTemplate.query(query, handler,
                    idGateway, valueType.toString(), startDateTime, endDateTime);
            return result;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private GatewayData mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new GatewayData(
                rs.getString("id_gateway"),
                rs.getTimestamp("received_at").toLocalDateTime(),
                rs.getString("value"),
                rs.getString("value_type")
        );
    }

    private static java.sql.Timestamp ts(Date d) {
        return d == null ? null : new java.sql.Timestamp(d.getTime());
    }
}
