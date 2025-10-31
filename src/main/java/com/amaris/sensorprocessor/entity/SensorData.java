package com.amaris.sensorprocessor.entity;

import lombok.Data;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Table("data_emsdesk")
public class SensorData {
   
    @Id
    @Column("id_sensor")
    private String idSensor; // AKA DEV_EUI

    @Id
    @Column("timestamp")
    private LocalDateTime timestamp;   

    @Column("humidity")
    private Integer humidity;

    @Column("temperature")
    private Double temperature;

    @Column("occupancy")
    private Integer occupancy;

}
