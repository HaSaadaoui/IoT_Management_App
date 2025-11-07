package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.SensorData.SensorData;

import lombok.AllArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@AllArgsConstructor
@Repository
public class SensorDataDao {
    private final JdbcTemplate jdbcTemplate;

    public int insertSensorData(SensorData sensorData) {
        return jdbcTemplate.update(
            "INSERT INTO sensor_data (id_sensor, created_at, string_value, value_type) VALUES (?, ?, ?, ?);",
            sensorData.getIdSensor(),
            sensorData.getCreatedAt(),
            sensorData.getAsString(),
            sensorData.getValueType().toString()
        );
    }

}
