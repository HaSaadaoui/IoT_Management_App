package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Building;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class BuildingDao {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final RowMapper<Building> buildingRowMapper = (rs, rowNum) -> {
        Building b = new Building();
        b.setId(rs.getInt("id"));
        b.setName(rs.getString("name"));
        b.setSvgPlan(rs.getString("svg_plan"));
        b.setFloorsCount(rs.getInt("floors_count"));
        b.setScale(rs.getDouble("scale"));

        String json = rs.getString("excluded_floors");
        if (json != null && !json.isBlank()) {
            try {
                b.setExcludedFloors(objectMapper.readValue(json, new TypeReference<List<Integer>>() {}));
            } catch (JsonProcessingException e) {
                b.setExcludedFloors(new ArrayList<>());
            }
        }
        return b;
    };

    private String toJson(List<Integer> list) {
        try {
            return objectMapper.writeValueAsString(list != null ? list : new ArrayList<>());
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

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
                buildingRowMapper
        );
    }

    /**
     * Recherche un building par son ID.
     */
    public Optional<Building> findBuildingById(Integer id) {
        List<Building> buildings = jdbcTemplate.query(
                "SELECT * FROM building WHERE id = ?",
                buildingRowMapper,
                id
        );
        return buildings.isEmpty() ? Optional.empty() : Optional.of(buildings.get(0));
    }

    /**
     * Insère un building en base.
     */
    public int insertBuilding(Building building) {
        return jdbcTemplate.update(
                "INSERT INTO building (name, svg_plan, floors_count, scale, excluded_floors) VALUES (?, ?, ?, ?, ?)",
                building.getName(),
                building.getSvgPlan(),
                building.getFloorsCount(),
                building.getScale(),
                toJson(building.getExcludedFloors())
        );
    }

    /**
     * Met à jour un building existant (via son id).
     */
    public int updateBuilding(Building building) {
        return jdbcTemplate.update(
                "UPDATE building SET name = ?, svg_plan = ?, floors_count = ?, scale = ?, excluded_floors = ? WHERE id = ?",
                building.getName(),
                building.getSvgPlan(),
                building.getFloorsCount(),
                building.getScale(),
                toJson(building.getExcludedFloors()),
                building.getId()
        );
    }

    /**
     * Met à jour un building existant (via son id) sauf svg_plan.
     */
    public int updateBuildingWithoutSVG(Building building) {
        return jdbcTemplate.update(
                "UPDATE building SET name = ?, floors_count = ?, scale = ?, excluded_floors = ? WHERE id = ?",
                building.getName(),
                building.getFloorsCount(),
                building.getScale(),
                toJson(building.getExcludedFloors()),
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
