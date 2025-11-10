package com.amaris.sensorprocessor.repository;

import lombok.AllArgsConstructor;

import java.util.HashSet;
import java.util.List;

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

    public List<SensorData> getSensorData(String idSensor) {
        int limit = 100;
        String query = "SELECT * FROM sensor_data WHERE id_sensor = ? ORDER BY received_at DESC, value_type, id_sensor LIMIT ?";
        var result = jdbcTemplate.query(query, (rs, rowNum) -> {
            SensorData sensorData = new SensorData(
                rs.getString("id_sensor"),
                rs.getTimestamp("received_at").toLocalDateTime(),
                rs.getString("string_value"),
                rs.getString("value_type")
            );
            return sensorData;
        }, idSensor, limit);
        return result;
    }

}
