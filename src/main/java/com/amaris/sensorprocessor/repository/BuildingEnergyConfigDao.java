package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.BuildingEnergyConfig;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class BuildingEnergyConfigDao {

    private final JdbcTemplate jdbcTemplate;

    public BuildingEnergyConfigDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        createTableIfNotExists();
    }

    private void createTableIfNotExists() {
        String sql = """
            CREATE TABLE IF NOT EXISTS building_energy_config (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                building_id INT UNIQUE NOT NULL,
                energy_cost_per_kwh DOUBLE DEFAULT 0.0,
                currency VARCHAR(10) DEFAULT 'EUR',
                co2_emission_factor DOUBLE DEFAULT 0.0,
                FOREIGN KEY (building_id) REFERENCES building(id_building)
            )
        """;
        jdbcTemplate.execute(sql);
    }

    private final RowMapper<BuildingEnergyConfig> rowMapper = (rs, rowNum) -> {
        BuildingEnergyConfig config = new BuildingEnergyConfig();
        config.setId(rs.getLong("id"));
        config.setBuildingId(rs.getInt("building_id")); // ✅
        config.setEnergyCostPerKwh(rs.getDouble("energy_cost_per_kwh"));
        config.setCurrency(rs.getString("currency"));
        config.setCo2EmissionFactor(rs.getDouble("co2_emission_factor"));
        return config;
    };

    public List<BuildingEnergyConfig> findAll() {
        return jdbcTemplate.query(
                "SELECT * FROM building_energy_config ORDER BY building_id", rowMapper);
    }

    // ✅ findByBuildingName → findByBuildingId
    public Optional<BuildingEnergyConfig> findByBuildingId(Integer buildingId) {
        if (buildingId == null) return Optional.empty();
        List<BuildingEnergyConfig> results = jdbcTemplate.query(
                "SELECT * FROM building_energy_config WHERE building_id = ?", rowMapper, buildingId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public void save(BuildingEnergyConfig config) {
        String sql = """
            INSERT INTO building_energy_config (building_id, energy_cost_per_kwh, currency, co2_emission_factor)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                energy_cost_per_kwh = VALUES(energy_cost_per_kwh),
                currency = VALUES(currency),
                co2_emission_factor = VALUES(co2_emission_factor)
        """;
        jdbcTemplate.update(sql,
                config.getBuildingId(),
                config.getEnergyCostPerKwh(),
                config.getCurrency(),
                config.getCo2EmissionFactor()
        );
    }

    public void delete(Integer buildingId) {
        jdbcTemplate.update(
                "DELETE FROM building_energy_config WHERE building_id = ?", buildingId);
    }

    public Double getEnergyCostPerKwh(Integer buildingId) {
        return findByBuildingId(buildingId)
                .map(BuildingEnergyConfig::getEnergyCostPerKwh)
                .orElse(0.0);
    }

    public Double getCo2EmissionFactor(Integer buildingId) {
        return findByBuildingId(buildingId)
                .map(BuildingEnergyConfig::getCo2EmissionFactor)
                .orElse(0.0);
    }

    public String getCurrency(Integer buildingId) {
        return findByBuildingId(buildingId)
                .map(BuildingEnergyConfig::getCurrency)
                .orElse("EUR");
    }
}
