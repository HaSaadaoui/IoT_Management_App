package com.amaris.sensorprocessor.repository;

import lombok.AllArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.ArrayList;
import java.util.Date;
import java.time.Instant;
import java.time.LocalDateTime;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.entity.MonitoringSensorData.Payload;
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

    public List<SensorData> findSensorDataByPeriodAndType(String idSensor, Date startDate, Date endDate, PayloadValueType valueType) {
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? AND value_type = ? AND received_at BETWEEN ? AND ? ORDER BY received_at ASC";

        try {
            return jdbcTemplate.query(query, (rs, rowNum) -> {
                SensorData sensorData = new SensorData(
                    rs.getString("id_sensor"),
                    rs.getTimestamp("received_at").toLocalDateTime(),
                    rs.getString("string_value"),
                    rs.getString("value_type")
                );
                return sensorData;
            }, idSensor, valueType.toString(), startDate, endDate);
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

}
