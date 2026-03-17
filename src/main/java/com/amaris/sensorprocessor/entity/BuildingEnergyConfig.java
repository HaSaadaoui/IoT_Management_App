package com.amaris.sensorprocessor.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Table("building_energy_config")
public class BuildingEnergyConfig {
    
    @Id
    private Long id;
    
    @Column("building_id")
    private Integer buildingId;

    
    @Column("energy_cost_per_kwh")
    private Double energyCostPerKwh;
    
    @Column("currency")
    private String currency;
    
    @Column("co2_emission_factor")
    private Double co2EmissionFactor;
    
    public BuildingEnergyConfig(Integer buildingId, Double energyCostPerKwh, String currency, Double co2EmissionFactor) {
        this.buildingId = buildingId;
        this.energyCostPerKwh = energyCostPerKwh;
        this.currency = currency;
        this.co2EmissionFactor = co2EmissionFactor;
    }
}
