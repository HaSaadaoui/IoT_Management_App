package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Building;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class BuildingDao {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public BuildingDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Récupère tous les buildings triés par nom (insensible à la casse).
     */
    public List<Building> findAllBuildings() {
        return jdbcTemplate.query(
                "SELECT * FROM building ORDER BY LOWER(name) ASC",
                new BeanPropertyRowMapper<>(Building.class)
        );
    }

    /**
     * Recherche un building par son ID.
     */
    public Optional<Building> findBuildingById(Integer id) {
        List<Building> buildings = jdbcTemplate.query(
                "SELECT * FROM building WHERE id = ?",
                new BeanPropertyRowMapper<>(Building.class),
                id
        );
        return buildings.isEmpty() ? Optional.empty() : Optional.of(buildings.get(0));
    }

    /**
     * Insère un building en base.
     */
    public int insertBuilding(Building building) {
        return jdbcTemplate.update(
                "INSERT INTO building (name, svg_plan, floors_count, scale) VALUES (?, ?, ?, ?)",
                building.getName(),
                building.getSvgPlan(),
                building.getFloorsCount(),
                building.getScale()
        );
    }

    /**
     * Met à jour un building existant (via son id).
     */
    public int updateBuilding(Building building) {
        return jdbcTemplate.update(
                "UPDATE building SET name = ?, svg_plan = ?, floors_count = ?, scale = ? WHERE id = ?",
                building.getName(),
                building.getSvgPlan(),
                building.getFloorsCount(),
                building.getScale(),
                building.getId()
        );
    }

    /**
     * Supprime un building par son ID.
     */
    public int deleteBuildingById(Integer id) {
        return jdbcTemplate.update(
                "DELETE FROM building WHERE id = ?",
                id
        );
    }
}
