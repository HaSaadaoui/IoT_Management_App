package com.amaris.sensorprocessor.repository;

import lombok.AllArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.Date;

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

    public List<SensorData> findSensorDataByPeriod(String idSensor, Date startDate, Date endDate, PayloadValueType valueType) {
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
}
