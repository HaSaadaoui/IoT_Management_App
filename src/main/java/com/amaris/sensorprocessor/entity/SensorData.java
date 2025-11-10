package com.amaris.sensorprocessor.entity;


import lombok.Data;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.ManyToOne;

@Data
@Table("sensor_data")
public class SensorData {

    // Constructor
    public SensorData(String idSensor, LocalDateTime receivedAt, String asString, String valueType) {
        this.id = null; // Let the database handle the ID generation
        this.idSensor = idSensor;
        this.receivedAt = receivedAt;
        this.asString = asString;
        this.valueType = PayloadValueType.valueOf(valueType);
    }

    @Id
    @Column("id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column("id_sensor")
    private String idSensor;

    @Id
    @Column("received_at")
    private LocalDateTime receivedAt;

    @Column("string_value")
    private String asString;

    @Column("value_type")
    @Enumerated(EnumType.STRING)
    private PayloadValueType valueType;

    @ManyToOne
    private Sensor sensor;

}
