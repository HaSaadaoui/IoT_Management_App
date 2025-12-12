package com.amaris.sensorprocessor.entity;

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

    private double scale;

    public Building() {}

    public Building(String name, String svgPlan, int floorsCount, double scale) {
        this.name = name;
        this.svgPlan = svgPlan;
        this.floorsCount = floorsCount;
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
                ", scale=" + scale +
                '}';
    }
}
