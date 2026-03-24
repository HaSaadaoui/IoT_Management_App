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

    private static final String BASE_SELECT =
            "SELECT s.* " +                                                    // ✅ s.* suffit, device_type est déjà dans la table
                    "FROM sensors s " +
                    "LEFT JOIN device_type dt ON s.id_device_type = dt.id_device_type ";
    @Autowired
    public SensorDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Sensor> findAllSensors() {
        return jdbcTemplate.query(BASE_SELECT, new BeanPropertyRowMapper<>(Sensor.class));
    }

    public List<Sensor> findAllByBuildingId(Integer buildingId) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE s.building_id = ?",
                new BeanPropertyRowMapper<>(Sensor.class), buildingId);
    }

    public List<String> findAllGateways() {
        return jdbcTemplate.queryForList(
                "SELECT DISTINCT id_gateway FROM sensors WHERE id_gateway IS NOT NULL",
                String.class);
    }

    public Optional<Sensor> findByIdOfSensor(String id) {
        List<Sensor> sensors = jdbcTemplate.query(
                BASE_SELECT + "WHERE s.id_sensor = ?",
                new BeanPropertyRowMapper<>(Sensor.class), id);
        return sensors.isEmpty() ? Optional.empty() : Optional.of(sensors.get(0));
    }

    public int deleteByIdOfSensor(String id) {
        return jdbcTemplate.update("DELETE FROM sensors WHERE id_sensor = ?", id);
    }

    public int insertSensor(Sensor sensor) {
        return jdbcTemplate.update(
                "INSERT INTO sensors (" +
                        "id_sensor, id_device_type, commissioning_date, status, " +
                        "building_id, floor, location_id, id_gateway, " +
                        "dev_eui, join_eui, app_key, frequency_plan, " +
                        "brand_id, protocol_id" +
                        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                sensor.getIdSensor(),
                sensor.getIdDeviceType(),
                sensor.getCommissioningDate(),
                sensor.getStatus(),
                sensor.getBuildingId(),
                sensor.getFloor(),
                sensor.getLocationId(),
                sensor.getIdGateway(),
                sensor.getDevEui(),
                sensor.getJoinEui(),
                sensor.getAppKey(),
                sensor.getFrequencyPlan(),
                sensor.getBrandId(),
                sensor.getProtocolId());
    }

    public List<Sensor> findAllByDeviceType(String deviceType) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE dt.type_name = ?", // ✅
                new BeanPropertyRowMapper<>(Sensor.class), deviceType);
    }

    public List<Sensor> findAllByDeviceTypeAndBuilding(String deviceType, Integer buildingId) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE dt.type_name = ? AND s.building_id = ?",
                new BeanPropertyRowMapper<>(Sensor.class), deviceType, buildingId);
    }

    public boolean existsByBuildingAndType(String deviceType, Integer buildingId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM sensors s " +
                        "JOIN device_type dt ON s.id_device_type = dt.id_device_type " +
                        "WHERE dt.type_name = ? AND s.building_id = ?",
                Integer.class, deviceType, buildingId);
        return count != null && count > 0;
    }

    public List<Sensor> findAllByLocationId(Integer locationId) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE s.location_id = ?",
                new BeanPropertyRowMapper<>(Sensor.class), locationId);
    }

    public List<Sensor> findAllByBuildingAndFloor(String buildingId, Integer floorNumber) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE s.building_id = ? AND s.floor = ?",
                new BeanPropertyRowMapper<>(Sensor.class), buildingId, floorNumber);
    }

    public int updateSensor(Sensor sensor) {
        return jdbcTemplate.update(
                "UPDATE sensors SET " +
                        "id_device_type = ?, " +
                        "commissioning_date = ?, " +
                        "status = ?, " +
                        "building_id = ?, " +
                        "floor = ?, " +
                        "location_id = ?, " +
                        "id_gateway = ?, " +
                        "dev_eui = ?, " +
                        "join_eui = ?, " +
                        "app_key = ?, " +
                        "frequency_plan = ?, " +
                        "brand_id = ?, " +
                        "protocol_id = ? " +
                        "WHERE id_sensor = ?",
                sensor.getIdDeviceType(),
                sensor.getCommissioningDate(),
                sensor.getStatus(),
                sensor.getBuildingId(),
                sensor.getFloor(),
                sensor.getLocationId(),
                sensor.getIdGateway(),
                sensor.getDevEui(),
                sensor.getJoinEui(),
                sensor.getAppKey(),
                sensor.getFrequencyPlan(),
                sensor.getBrandId(),
                sensor.getProtocolId(),
                sensor.getIdSensor());
    }

    public List<Sensor> findAllByDeviceTypes(List<String> deviceTypes) {
        String placeholders = deviceTypes.stream().map(t -> "?").collect(Collectors.joining(","));
        String sql = BASE_SELECT + "WHERE dt.type_name IN (" + placeholders + ")"; // ✅
        return jdbcTemplate.query(sql, new BeanPropertyRowMapper<>(Sensor.class), deviceTypes.toArray());
    }

    public Optional<Sensor> findByDevEui(String devEui) {
        List<Sensor> sensors = jdbcTemplate.query(
                BASE_SELECT + "WHERE s.dev_eui = ?",
                new BeanPropertyRowMapper<>(Sensor.class), devEui);
        return sensors.isEmpty() ? Optional.empty() : Optional.of(sensors.get(0));
    }
}
