package com.amaris.sensorprocessor.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Table("Sensors")
public class Sensor {

    public Sensor() {}

    // ⇨ Si tu gardes un constructeur custom, pense à l’aligner avec les nouveaux champs
    public Sensor(String idSensor, String deviceType, String commissioningDate,
                  Boolean status, String buildingName, Integer floor,
                  String location, String idGateway,
                  String devEui, String joinEui, String appKey, String frequencyPlan) {
        this.idSensor = idSensor;
        this.deviceType = deviceType;
        this.commissioningDate = commissioningDate;
        this.status = status;
        this.buildingName = buildingName;
        this.floor = floor;
        this.location = location;
        this.idGateway = idGateway;
        this.devEui = devEui;
        this.joinEui = joinEui;
        this.appKey = appKey;
        this.frequencyPlan = frequencyPlan;
    }

    @Id
    @Column("id_sensor")
    private String idSensor;

    @Column("device_type")
    private String deviceType;

    @Column("commissioning_date")
    private String commissioningDate;

    @Column("status")
    private Boolean status;

    @Column("building_name")
    private String buildingName;

    @Column("floor")
    private Integer floor;

    @Column("location")
    private String location;

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
}
