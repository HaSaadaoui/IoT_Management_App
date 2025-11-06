package com.amaris.sensorprocessor.entity;

import lombok.Data;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.persistence.ManyToOne;

@Data
@Table("data_emsdesk")
public class EmsDeskData {

    // Constructor
    public EmsDeskData() {}

    public EmsDeskData(String idSensor, LocalDateTime timestamp, Integer humidity, Double temperature, Integer occupancy) {
        this.idSensor = idSensor;
        this.timestamp = timestamp;
        this.humidity = humidity;
        this.temperature = temperature;
        this.occupancy = occupancy;
    }
   
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

    @ManyToOne
    private Sensor sensor;

}
