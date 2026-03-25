package com.amaris.sensorprocessor.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
@Data
@Table("sensors")
public class Sensor {

    public Sensor() {}

    public Sensor(String idSensor, Integer idDeviceType, String commissioningDate,
                  Boolean status, Integer buildingId, Integer floor,
                  String idGateway,
                  String devEui, String joinEui, String appKey, String frequencyPlan,
                  Integer brandId, Integer protocolId) {
        this.idSensor = idSensor;
        this.idDeviceType = idDeviceType;
        this.commissioningDate = commissioningDate;
        this.status = status;
        this.buildingId = buildingId;
        this.floor = floor;
        this.idGateway = idGateway;
        this.devEui = devEui;
        this.joinEui = joinEui;
        this.appKey = appKey;
        this.frequencyPlan = frequencyPlan;
        this.brandId = brandId;
        this.protocolId = protocolId;
    }

    @Id
    @Column("id_sensor")
    private String idSensor;

    @Column("id_device_type")
    private Integer idDeviceType;

    @Column("commissioning_date")
    private String commissioningDate;

    @Column("status")
    private Boolean status;

    @Column("building_id")
    private Integer buildingId;

    @Column("floor")
    private Integer floor;

    @Column("location_id")
    private Integer locationId;

    @Column("id_gateway")
    private String idGateway;

    @Column("dev_eui")
    private String devEui;

    @Column("join_eui")
    private String joinEui;

    @Column("app_key")
    private String appKey;

    @Column("frequency_plan")
    private String frequencyPlan;

    @Column("brand_id")
    private Integer brandId;

    @Column("protocol_id")
    private Integer protocolId;
}
