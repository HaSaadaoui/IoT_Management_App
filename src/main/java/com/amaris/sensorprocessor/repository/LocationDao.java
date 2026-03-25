package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Location;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class LocationDao {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<Location> locationRowMapper = (rs, rowNum) -> {
        Location l = new Location();
        l.setId(rs.getInt("id"));
        l.setName(rs.getString("name"));
        l.setBuildingId(rs.getInt("building_id"));
        return l;
    };

    @Autowired
    public LocationDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Location> findAll() {
        return jdbcTemplate.query("SELECT * FROM location ORDER BY name ASC", locationRowMapper);
    }

    public Optional<Location> findById(Integer id) {
        List<Location> results = jdbcTemplate.query(
                "SELECT * FROM location WHERE id = ?", locationRowMapper, id);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public List<Location> findByBuildingAndFloor(Integer buildingId, Integer floor) {
        return jdbcTemplate.query(
                "SELECT DISTINCT l.id, l.name, l.building_id FROM location l " +
                "JOIN sensors s ON s.location_id = l.id " +
                "WHERE l.building_id = ? AND s.floor = ? " +
                "ORDER BY l.name ASC",
                locationRowMapper, buildingId, floor);
    }

    public List<Location> findByBuilding(Integer buildingId) {
        return jdbcTemplate.query(
                "SELECT * FROM location WHERE building_id = ? ORDER BY name ASC",
                locationRowMapper, buildingId);
    }

    public int insert(Location location) {
        return jdbcTemplate.update(
                "INSERT INTO location (name, building_id) VALUES (?, ?)",
                location.getName(), location.getBuildingId());
    }

    public int update(Location location) {
        return jdbcTemplate.update(
                "UPDATE location SET name = ?, building_id = ? WHERE id = ?",
                location.getName(), location.getBuildingId(), location.getId());
    }

    public int deleteById(Integer id) {
        return jdbcTemplate.update("DELETE FROM location WHERE id = ?", id);
    }
}
