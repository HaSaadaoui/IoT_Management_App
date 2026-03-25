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
                building_name VARCHAR(255) UNIQUE NOT NULL,
                energy_cost_per_kwh DOUBLE DEFAULT 0.0,
                currency VARCHAR(10) DEFAULT 'EUR',
                co2_emission_factor DOUBLE DEFAULT 0.0
            )
        """;
        jdbcTemplate.execute(sql);
    }

    private final RowMapper<BuildingEnergyConfig> rowMapper = (rs, rowNum) -> {
        BuildingEnergyConfig config = new BuildingEnergyConfig();
        config.setId(rs.getLong("id"));
        config.setBuildingName(rs.getString("building_name"));
        config.setEnergyCostPerKwh(rs.getDouble("energy_cost_per_kwh"));
        config.setCurrency(rs.getString("currency"));
        config.setCo2EmissionFactor(rs.getDouble("co2_emission_factor"));
        return config;
    };

    public List<BuildingEnergyConfig> findAll() {
        String sql = "SELECT * FROM building_energy_config ORDER BY building_name";
        return jdbcTemplate.query(sql, rowMapper);
    }

    public Optional<BuildingEnergyConfig> findByBuildingName(String buildingName) {
        String sql = "SELECT * FROM building_energy_config WHERE building_name = ?";
        List<BuildingEnergyConfig> results = jdbcTemplate.query(sql, rowMapper, buildingName);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public void save(BuildingEnergyConfig config) {
        String sql = """
            INSERT INTO building_energy_config (building_name, energy_cost_per_kwh, currency, co2_emission_factor)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                energy_cost_per_kwh = VALUES(energy_cost_per_kwh),
                currency = VALUES(currency),
                co2_emission_factor = VALUES(co2_emission_factor)
        """;
        jdbcTemplate.update(sql, 
            config.getBuildingName(), 
            config.getEnergyCostPerKwh(), 
            config.getCurrency(),
            config.getCo2EmissionFactor()
        );
    }

    public void delete(String buildingName) {
        String sql = "DELETE FROM building_energy_config WHERE building_name = ?";
        jdbcTemplate.update(sql, buildingName);
    }

    public Double getEnergyCostPerKwh(String buildingName) {
        return findByBuildingName(buildingName)
                .map(BuildingEnergyConfig::getEnergyCostPerKwh)
                .orElse(0.0);
    }

    public Double getCo2EmissionFactor(String buildingName) {
        return findByBuildingName(buildingName)
                .map(BuildingEnergyConfig::getCo2EmissionFactor)
                .orElse(0.0);
    }

    public String getCurrency(String buildingName) {
        return findByBuildingName(buildingName)
                .map(BuildingEnergyConfig::getCurrency)
                .orElse("EUR");
    }
}
