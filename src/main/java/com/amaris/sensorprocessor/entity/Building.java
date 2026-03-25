package com.amaris.sensorprocessor.entity;

import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.*;

@Entity
@Table(name = "building")
public class Building {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String name;

    @Column(name = "svg_plan")
    private String svgPlan;

    @Column(name = "floors_count")
    private int floorsCount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "excluded_floors", columnDefinition = "json")
    private List<Integer> excludedFloors = new ArrayList<>();

    private double scale;

    public Building() {}

    public Building(String name, String svgPlan, int floorsCount, List<Integer> excludedFloors, double scale) {
        this.name = name;
        this.svgPlan = svgPlan;
        this.floorsCount = floorsCount;
        this.excludedFloors = excludedFloors;
        this.scale = scale;
    }

    // ======== GETTERS ========

    public Integer getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getSvgPlan() {
        return svgPlan;
    }

    public int getFloorsCount() {
        return floorsCount;
    }

    public List<Integer> getExcludedFloors() {
        return excludedFloors;
    }

    public double getScale() {
        return scale;
    }

    // ======== SETTERS ========

    public void setId(Integer id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setSvgPlan(String svgPlan) {
        this.svgPlan = svgPlan;
    }

    public void setFloorsCount(int floorsCount) {
        this.floorsCount = floorsCount;
    }

    public void setExcludedFloors(List<Integer> excludedFloors) {
        this.excludedFloors = excludedFloors != null ? excludedFloors : new ArrayList<>();
    }

    public void setScale(double scale) {
        this.scale = scale;
    }

    // ======== DEBUG / LOGGING (OPTION) ========

    @Override
    public String toString() {
        return "Building{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", svgPlan='" + svgPlan + '\'' +
                ", floorsCount=" + floorsCount +
                ", excludedFloors=" + excludedFloors +
                ", scale=" + scale +
                '}';
    }
}
