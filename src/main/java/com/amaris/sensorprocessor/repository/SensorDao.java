package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Sensor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class SensorDao {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public SensorDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Récupère tous les capteurs. */
    public List<Sensor> findAllSensors() {
        return jdbcTemplate.query(
                "SELECT * FROM SENSORS",
                new BeanPropertyRowMapper<>(Sensor.class)
        );
    }

    /** Récupère un capteur par son ID. */
    public Optional<Sensor> findByIdOfSensor(String id) {
        List<Sensor> sensors = jdbcTemplate.query(
                "SELECT * FROM SENSORS WHERE ID_SENSOR = ?",
                new BeanPropertyRowMapper<>(Sensor.class),
                id
        );
        return sensors.isEmpty() ? Optional.empty() : Optional.of(sensors.get(0));
    }

    /** Supprime un capteur par son ID. */
    public int deleteByIdOfSensor(String id) {
        return jdbcTemplate.update(
                "DELETE FROM SENSORS WHERE ID_SENSOR = ?",
                id
        );
    }

    /** Insère un capteur (avec EUIs, AppKey et Frequency Plan). */
    public int insertSensor(Sensor sensor) {
        return jdbcTemplate.update(
                "INSERT INTO SENSORS (" +
                        "ID_SENSOR, DEVICE_TYPE, COMMISSIONING_DATE, STATUS, " +
                        "BUILDING_NAME, FLOOR, LOCATION, ID_GATEWAY, " +
                        "DEV_EUI, JOIN_EUI, APP_KEY, FREQUENCY_PLAN" +
                        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                sensor.getIdSensor(),
                sensor.getDeviceType(),
                sensor.getCommissioningDate(),
                sensor.getStatus(),
                sensor.getBuildingName(),
                sensor.getFloor(),
                sensor.getLocation(),
                sensor.getIdGateway(),
                sensor.getDevEui(),
                sensor.getJoinEui(),
                sensor.getAppKey(),
                sensor.getFrequencyPlan()
        );
    }

    /** Met à jour TOUTES les colonnes (sauf la PK). */
    public int updateSensor(Sensor sensor) {
        return jdbcTemplate.update(
                "UPDATE SENSORS SET " +
                        "DEVICE_TYPE = ?, " +
                        "COMMISSIONING_DATE = ?, " +
                        "STATUS = ?, " +
                        "BUILDING_NAME = ?, " +
                        "FLOOR = ?, " +
                        "LOCATION = ?, " +
                        "ID_GATEWAY = ?, " +
                        "DEV_EUI = ?, " +
                        "JOIN_EUI = ?, " +
                        "APP_KEY = ?, " +
                        "FREQUENCY_PLAN = ? " +
                        "WHERE ID_SENSOR = ?",
                sensor.getDeviceType(),
                sensor.getCommissioningDate(),
                sensor.getStatus(),
                sensor.getBuildingName(),
                sensor.getFloor(),
                sensor.getLocation(),
                sensor.getIdGateway(),
                sensor.getDevEui(),
                sensor.getJoinEui(),
                sensor.getAppKey(),
                sensor.getFrequencyPlan(),
                sensor.getIdSensor()
        );
    }
}
