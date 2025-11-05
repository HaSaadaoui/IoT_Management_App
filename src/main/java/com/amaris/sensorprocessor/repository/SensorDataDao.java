package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.SensorData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class SensorDataDao {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public SensorDataDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int insertSensorData(SensorData sensorData) {
        return jdbcTemplate.update(
                "INSERT INTO data_emsdesk (id_sensor, timestamp, humidity, temperature, occupancy) VALUES (?, ?, ?, ?, ?)",
                sensorData.getIdSensor(),
                sensorData.getTimestamp(),
                sensorData.getHumidity(),
                sensorData.getTemperature(),
                sensorData.getOccupancy()
        );
    }

    public List<SensorData> findSensorDataBySensorId(String idSensor) {
        return jdbcTemplate.query(
                "SELECT (id_sensor, timestamp, humidity, temperature, occupancy) FROM data_emsdesk WHERE id_sensor = ? ORDER BY timestamp DESC",
                new BeanPropertyRowMapper<>(SensorData.class),
                idSensor
        );
    }

    public Optional<SensorData> findLatestSensorDataBySensorId(String idSensor) {
        List<SensorData> sensorDataList = jdbcTemplate.query(
                "SELECT (id_sensor, timestamp, humidity, temperature, occupancy) FROM data_emsdesk WHERE id_sensor = ? ORDER BY timestamp DESC LIMIT 1",
                new BeanPropertyRowMapper<>(SensorData.class),
                idSensor
        );
        return sensorDataList.isEmpty() ? Optional.empty() : Optional.of(sensorDataList.get(0));
    }

}
