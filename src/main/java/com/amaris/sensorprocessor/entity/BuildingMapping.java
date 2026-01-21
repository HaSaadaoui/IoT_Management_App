package com.amaris.sensorprocessor.entity;

import java.util.Arrays;

public enum BuildingMapping {


    CHATEAUDUN("CHATEAUDUN", "Châteaudun-Building"),
    LEVALLOIS("LEVALLOIS", "Levallois-Building"),
    STRASBOURG("STRASBOURG", "Strasbourg-Building"),
    MARSEILLE("MARSEILLE", "Marseille-Building"),
    LILLE("LILLE", "Lille-Building");

    private final String code;
    private final String dbName;

    BuildingMapping(String code, String dbName) {
        this.code = code;
        this.dbName = dbName;
    }

    public static String toDbName(String code) {
        if (code == null) {
            return null;
        }
        return Arrays.stream(values())
                .filter(b -> b.code.equalsIgnoreCase(code))
                .map(BuildingMapping::getDbName)
                .findFirst()
                .orElse(null);
    }

    public String getDbName() {
        return dbName;
    }
}
