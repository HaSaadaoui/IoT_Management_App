package com.amaris.sensorprocessor.entity;

import lombok.Data;


import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.persistence.ManyToOne;

@Data
@Table("data_pirlight")
public class PirLightData {

    @Id
    @Column("id_sensor")
    private String idSensor;

    @Id
    @Column("timestamp")
    private java.time.LocalDateTime timestamp;

    @Column("light_statut")
    private Integer lightStatut;

    @Column("motion_statut")
    private Integer motionStatut;

    @ManyToOne
    private Sensor sensor;

}
