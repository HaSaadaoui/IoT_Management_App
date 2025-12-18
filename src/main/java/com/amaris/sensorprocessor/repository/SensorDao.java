package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Sensor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

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
                "SELECT * FROM sensors",
                new BeanPropertyRowMapper<>(Sensor.class)
        );
    }

    public List<String> findAllGateways() {
        return jdbcTemplate.queryForList(
                "SELECT DISTINCT id_gateway FROM sensors WHERE id_gateway IS NOT NULL",
                String.class
        );
    }

    /** Récupère un capteur par son ID. */
    public Optional<Sensor> findByIdOfSensor(String id) {
        List<Sensor> sensors = jdbcTemplate.query(
                "SELECT * FROM sensors WHERE ID_SENSOR = ?",
                new BeanPropertyRowMapper<>(Sensor.class),
                id
        );
        return sensors.isEmpty() ? Optional.empty() : Optional.of(sensors.get(0));
    }

    /** Supprime un capteur par son ID. */
    public int deleteByIdOfSensor(String id) {
        return jdbcTemplate.update(
                "DELETE FROM sensors WHERE ID_SENSOR = ?",
                id
        );
    }

    /** Insère un capteur (colonnes de base uniquement). */
    public int insertSensor(Sensor sensor) {
        return jdbcTemplate.update(
                "INSERT INTO sensors (" +
                        "ID_SENSOR, DEVICE_TYPE, COMMISSIONING_DATE, STATUS, " +
                        "BUILDING_NAME, FLOOR, LOCATION, ID_GATEWAY, DEV_EUI, FREQUENCY_PLAN" +
                        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                sensor.getIdSensor(),
                sensor.getDeviceType(),
                sensor.getCommissioningDate(),
                sensor.getStatus(),
                sensor.getBuildingName(),
                sensor.getFloor(),
                sensor.getLocation(),
                sensor.getIdGateway(),
                sensor.getDevEui(),
                sensor.getFrequencyPlan()
        );
    }

    public List<Sensor> findAllByDeviceType(String deviceType) {
        return jdbcTemplate.query(
                "SELECT * FROM sensors WHERE DEVICE_TYPE = ?",
                new BeanPropertyRowMapper<>(Sensor.class),
                deviceType
        );
    }

    public List<Sensor> findAllByLocation(String location) {
        return jdbcTemplate.query(
                "SELECT * FROM sensors WHERE location = ?",
                new BeanPropertyRowMapper<>(Sensor.class),
                location
        );
    }

    /** Met à jour les colonnes de base (sauf la PK). */
    public int updateSensor(Sensor sensor) {
        return jdbcTemplate.update(
                "UPDATE sensors SET " +
                        "DEVICE_TYPE = ?, " +
                        "COMMISSIONING_DATE = ?, " +
                        "STATUS = ?, " +
                        "BUILDING_NAME = ?, " +
                        "FLOOR = ?, " +
                        "LOCATION = ?, " +
                        "ID_GATEWAY = ?, " +
                        "DEV_EUI = ?, " +
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
                sensor.getFrequencyPlan(),
                sensor.getIdSensor()
        );
    }

    /**
     * Récupère la liste des sensors des type_device renseignés
     * @param deviceTypes exemple: "DESK", "OCCUP"
     * @return les of sensors
     */
    public List<Sensor> findAllByDeviceTypes(List<String> deviceTypes) {
        String placeholders = deviceTypes.stream()
                .map(t -> "?")
                .collect(Collectors.joining(","));

        String sql = "SELECT * FROM sensors WHERE DEVICE_TYPE IN (" + placeholders + ")";

        return jdbcTemplate.query(
                sql,
                new BeanPropertyRowMapper<>(Sensor.class),
                deviceTypes.toArray()
        );
    }

}
