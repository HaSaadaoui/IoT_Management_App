package com.amaris.sensorprocessor.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Table("Gateways")
public class Gateway {

    public Gateway() {}

    public Gateway(String gatewayId, String gatewayEui, String ipAddress, Integer protocolId, String frequencyPlan,
                   String createdAt, Integer buildingId, Integer floorNumber, String locationDescription,
                   Double antennaLatitude, Double antennaLongitude, Double antennaAltitude) {
        this.gatewayId = gatewayId;
        this.gatewayEui = gatewayEui;
        this.ipAddress = ipAddress;
        this.protocolId = protocolId;
        this.frequencyPlan = frequencyPlan;
        this.createdAt = createdAt;
        this.buildingId = buildingId;
        this.floorNumber = floorNumber;
        this.locationDescription = locationDescription;
        this.antennaLatitude = antennaLatitude;
        this.antennaLongitude = antennaLongitude;
        this.antennaAltitude = antennaAltitude;
    }

    @Id
    @Column("gateway_id")
    private String gatewayId;

    @Column("gateway_eui")
    private String gatewayEui;

    @Column("ip_address")
    private String ipAddress;

    @Column("protocol_id")
    private  Integer protocolId;

    @Column("frequency_plan")
    private String frequencyPlan;

    @Column("created_at")
    private String createdAt;

    @Column("building_id")
    private Integer buildingId;

    @Column("floor_number")
    private Integer floorNumber;

    @Column("location_description")
    private String locationDescription;

    @Column("antenna_latitude")
    private Double antennaLatitude;

    @Column("antenna_longitude")
    private Double antennaLongitude;

    @Column("antenna_altitude")
    private Double antennaAltitude;

}
