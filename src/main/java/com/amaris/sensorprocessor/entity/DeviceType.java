package com.amaris.sensorprocessor.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Table("device_type")
public class DeviceType {

    @Id
    @Column("id_device_type")
    private Integer idDeviceType;

    @Column("type_name")
    private String typeName;

    @Column("label")
    private String label;
}
