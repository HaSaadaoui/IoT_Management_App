package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.DeviceType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class DeviceTypeDao {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public DeviceTypeDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<DeviceType> findAll() {
        return jdbcTemplate.query(
                "SELECT id_device_type, type_name, COALESCE(NULLIF(label, ''), type_name) AS label FROM device_type",
                new BeanPropertyRowMapper<>(DeviceType.class));
    }

    public Optional<DeviceType> findById(Integer id) {
        List<DeviceType> result = jdbcTemplate.query(
                "SELECT id_device_type, type_name, COALESCE(NULLIF(label, ''), type_name) AS label FROM device_type WHERE id_device_type = ?",
                new BeanPropertyRowMapper<>(DeviceType.class), id);
        return result.isEmpty() ? Optional.empty() : Optional.of(result.get(0));
    }

    public Optional<DeviceType> findByLabel(String label) {
        List<DeviceType> result = jdbcTemplate.query(
                "SELECT id_device_type, type_name, COALESCE(NULLIF(label, ''), type_name) AS label " +
                        "FROM device_type " +
                        "WHERE UPPER(COALESCE(NULLIF(label, ''), type_name)) = UPPER(?) " +
                        "OR UPPER(type_name) = UPPER(?)",
                new BeanPropertyRowMapper<>(DeviceType.class), label, label);
        return result.isEmpty() ? Optional.empty() : Optional.of(result.get(0));
    }

    public void deleteById(Integer id) {
        jdbcTemplate.update(
                "DELETE FROM device_type WHERE id_device_type = ?", id);
    }

    public DeviceType insert(String label) {
        jdbcTemplate.update(
                "INSERT INTO device_type (type_name, label) VALUES (?, ?)", label, label);
        List<DeviceType> result = jdbcTemplate.query(
                "SELECT id_device_type, type_name, COALESCE(NULLIF(label, ''), type_name) AS label FROM device_type WHERE type_name = ?",
                new BeanPropertyRowMapper<>(DeviceType.class), label);
        return result.isEmpty() ? null : result.get(0);
    }

    public int update(Integer id, String label) {
        return jdbcTemplate.update(
                "UPDATE device_type SET label = ? WHERE id_device_type = ?",
                label, id);
    }
}
