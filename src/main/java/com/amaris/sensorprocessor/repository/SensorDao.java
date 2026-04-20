package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Sensor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class SensorDao {

    private final JdbcTemplate jdbcTemplate;

    private static final String BASE_SELECT =
            "SELECT s.* " +                                                    // ✅ s.* suffit, device_type est déjà dans la table
                    "FROM sensors s " +
                    "LEFT JOIN device_type dt ON s.id_device_type = dt.id_device_type ";

    private static final String ENV_SELECT =
            "SELECT s.id_sensor, l.name, dt.type_name " +
                    "FROM sensors s " +
                    "JOIN device_type dt ON s.id_device_type = dt.id_device_type " +
                    "LEFT JOIN location l ON s.location_id = l.id";

    private static final String OCCUPANCY_ZONES_SELECT =
            "SELECT s.id_sensor, s.floor, l.name, dt.type_name " +
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
        return findAllByExpandedDeviceTypes(deviceType == null ? List.of() : List.of(deviceType), null);
    }

    public List<Sensor> findAllByDeviceTypeAndBuilding(String deviceType, Integer buildingId) {
        return findAllByExpandedDeviceTypes(deviceType == null ? List.of() : List.of(deviceType), buildingId);
    }

    public boolean existsByBuildingAndType(String deviceType, Integer buildingId) {
        List<String> expandedTypes = expandDeviceTypes(deviceType == null ? List.of() : List.of(deviceType));
        if (expandedTypes.isEmpty()) {
            return false;
        }

        String placeholders = expandedTypes.stream().map(t -> "?").collect(Collectors.joining(","));
        List<Object> params = new ArrayList<>(expandedTypes);
        params.add(buildingId);

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM sensors s " +
                        "JOIN device_type dt ON s.id_device_type = dt.id_device_type " +
                        "WHERE dt.type_name IN (" + placeholders + ") AND s.building_id = ?",
                Integer.class, params.toArray());
        return count != null && count > 0;
    }

    public List<Sensor> findAllByLocationId(Integer locationId) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE s.location_id = ?",
                new BeanPropertyRowMapper<>(Sensor.class), locationId);
    }

    public List<Sensor> findAllByBrandId(Integer brandId) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE s.brand_id = ?",
                new BeanPropertyRowMapper<>(Sensor.class), brandId);
    }

    public List<Sensor> findAllByDeviceTypeId(Integer deviceTypeId) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE s.id_device_type = ?",
                new BeanPropertyRowMapper<>(Sensor.class), deviceTypeId);
    }

    public List<Sensor> findAllByProtocolId(Integer protocolId) {
        return jdbcTemplate.query(
                BASE_SELECT + "WHERE s.protocol_id = ?",
                new BeanPropertyRowMapper<>(Sensor.class), protocolId);
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
        return findAllByExpandedDeviceTypes(deviceTypes, null);
    }

    public Optional<Sensor> findByDevEui(String devEui) {
        List<Sensor> sensors = jdbcTemplate.query(
                BASE_SELECT + "WHERE s.dev_eui = ?",
                new BeanPropertyRowMapper<>(Sensor.class), devEui);
        return sensors.isEmpty() ? Optional.empty() : Optional.of(sensors.get(0));
    }


    public List<Map<String, Object>> findAllByBuildingAndFloorForConfig(String building, Integer floor) {
        if (floor != null) {
            String sql = ENV_SELECT + " WHERE s.building_id = ? AND s.floor = ? " +
                    "AND s.status = 1 AND dt.type_name IN ('CO2', 'SON', 'NOISE', 'TEMPEX', 'CONSO', 'ENERGY', 'EYE', 'DESK')";
            return jdbcTemplate.queryForList(sql, Integer.parseInt(building), floor);
        } else {
            String sql = ENV_SELECT + " WHERE s.building_id = ? " +
                    "AND s.status = 1 AND dt.type_name IN ('CO2', 'SON', 'NOISE', 'TEMPEX', 'CONSO', 'ENERGY', 'EYE', 'DESK')";
            return jdbcTemplate.queryForList(sql, Integer.parseInt(building));
        }
    }

    public List<Map<String, Object>> findZonesByBuilding(Integer buildingId) {
        return jdbcTemplate.queryForList(
                "SELECT s.id_sensor, s.floor, l.name AS location_name " +
                "FROM sensors s " +
                        "JOIN device_type dt ON s.id_device_type = dt.id_device_type " +
                "LEFT JOIN location l ON s.location_id = l.id " +
                "WHERE s.building_id = ? AND dt.type_name IN ('DESK', 'OCCUP') AND s.status = 1 " +
                "ORDER BY s.floor, l.name",
                buildingId
        );
    }

    private List<Sensor> findAllByExpandedDeviceTypes(List<String> deviceTypes, Integer buildingId) {
        List<String> expandedTypes = expandDeviceTypes(deviceTypes);
        if (expandedTypes.isEmpty()) {
            return List.of();
        }

        String placeholders = expandedTypes.stream().map(t -> "?").collect(Collectors.joining(","));
        String sql = BASE_SELECT + "WHERE dt.type_name IN (" + placeholders + ")";
        List<Object> params = new ArrayList<>(expandedTypes);

        if (buildingId != null) {
            sql += " AND s.building_id = ?";
            params.add(buildingId);
        }

        return jdbcTemplate.query(sql, new BeanPropertyRowMapper<>(Sensor.class), params.toArray());
    }

    private List<String> expandDeviceTypes(Collection<String> deviceTypes) {
        if (deviceTypes == null || deviceTypes.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> expandedTypes = new LinkedHashSet<>();
        for (String deviceType : deviceTypes) {
            if (deviceType == null || deviceType.isBlank()) {
                continue;
            }

            String normalized = deviceType.trim().toUpperCase();
            switch (normalized) {
                case "NOISE", "SON" -> {
                    expandedTypes.add("SON");
                    expandedTypes.add("NOISE");
                }
                case "ENERGY", "CONSO" -> {
                    expandedTypes.add("CONSO");
                    expandedTypes.add("ENERGY");
                }
                default -> expandedTypes.add(normalized);
            }
        }

        return new ArrayList<>(expandedTypes);
    }

}
