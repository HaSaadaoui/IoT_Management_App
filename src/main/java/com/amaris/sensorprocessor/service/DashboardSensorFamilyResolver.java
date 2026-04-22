package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.DeviceType;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

public final class DashboardSensorFamilyResolver {

    private static final List<String> PREFERRED_FILTER_ORDER = List.of(
            "COUNT",
            "CONSO",
            "CO2",
            "DESK",
            "LIGHT",
            "SON",
            "TEMP",
            "HUMIDITY"
    );

    private static final Map<String, String> DEFAULT_LABELS = Map.of(
            "COUNT", "Counting",
            "CONSO", "Power Consumption",
            "CO2", "Air Quality",
            "DESK", "Occupancy",
            "LIGHT", "Light / Presence",
            "SON", "Sound",
            "TEMP", "Temperature",
            "HUMIDITY", "Humidity"
    );

    private DashboardSensorFamilyResolver() {
    }

    public static List<DeviceType> buildFilterDeviceTypes(Collection<DeviceType> deviceTypes) {
        Map<String, DeviceType> resolved = new LinkedHashMap<>();

        for (DeviceType deviceType : deviceTypes) {
            if (deviceType == null) {
                continue;
            }

            LinkedHashSet<String> families = resolveFamilies(deviceType);
            if (families.isEmpty()) {
                String canonicalType = canonicalTypeName(deviceType);
                resolved.putIfAbsent(canonicalType, cloneAsDashboardType(deviceType, canonicalType, fallbackLabel(deviceType)));
                continue;
            }

            for (String family : families) {
                resolved.putIfAbsent(family, cloneAsDashboardType(deviceType, family, DEFAULT_LABELS.getOrDefault(family, fallbackLabel(deviceType))));
            }
        }

        List<DeviceType> ordered = new ArrayList<>();
        for (String code : PREFERRED_FILTER_ORDER) {
            DeviceType match = resolved.remove(code);
            if (match != null) {
                ordered.add(match);
            }
        }

        ordered.addAll(resolved.values());
        return ordered;
    }

    public static List<String> expandRequestedTypes(String sensorType, Collection<DeviceType> availableDeviceTypes) {
        if (sensorType == null || sensorType.isBlank()) {
            return List.of("DESK");
        }

        LinkedHashSet<String> resolvedTypes = new LinkedHashSet<>();
        for (String rawType : sensorType.split(",")) {
            String requestedFamily = normalizeToken(rawType);
            if (requestedFamily.isBlank()) {
                continue;
            }

            boolean matched = false;
            for (DeviceType deviceType : availableDeviceTypes) {
                if (deviceType == null) {
                    continue;
                }

                String canonicalType = canonicalTypeName(deviceType);
                LinkedHashSet<String> families = resolveFamilies(deviceType);
                if (canonicalType.equals(requestedFamily) || families.contains(requestedFamily)) {
                    resolvedTypes.add(canonicalType);
                    matched = true;
                }
            }

            if (!matched) {
                resolvedTypes.add(requestedFamily);
            }
        }

        return resolvedTypes.isEmpty() ? List.of("DESK") : new ArrayList<>(resolvedTypes);
    }

    public static LinkedHashSet<String> resolveFamilies(DeviceType deviceType) {
        LinkedHashSet<String> families = new LinkedHashSet<>();
        if (deviceType == null) {
            return families;
        }

        String canonicalType = canonicalTypeName(deviceType);
        String normalizedLabel = normalizeText(deviceType.getLabel());
        String normalizedType = normalizeText(deviceType.getTypeName());

        switch (canonicalType) {
            case "COUNT" -> families.add("COUNT");
            case "CONSO" -> families.add("CONSO");
            case "SON" -> families.add("SON");
            case "DESK" -> families.add("DESK");
            case "PIR_LIGHT", "PR" -> families.add("LIGHT");
            case "TEMPEX" -> {
                families.add("TEMP");
                families.add("HUMIDITY");
            }
            case "EYE" -> {
                families.add("LIGHT");
                families.add("TEMP");
                families.add("HUMIDITY");
            }
            case "CO2" -> {
                families.add("CO2");
                families.add("TEMP");
                families.add("HUMIDITY");
                families.add("LIGHT");
            }
            default -> {
            }
        }

        if (containsAny(normalizedType, normalizedLabel, "COUNT", "COMPTAGE")) {
            families.add("COUNT");
        }
        if (containsAny(normalizedType, normalizedLabel, "CONSO", "CONSUMPTION", "CONSOMMATION", "ENERGY", "POWER", "ELECTRIC")) {
            families.add("CONSO");
        }
        if (containsAny(normalizedType, normalizedLabel, "CO2", "AIR QUALITY", "QUALITE AIR")) {
            families.add("CO2");
        }
        if (containsAny(normalizedType, normalizedLabel, "DESK", "OCCUP", "POSTE", "WORKSTATION", "BUREAU")) {
            families.add("DESK");
        }
        if (containsAny(normalizedType, normalizedLabel, "LIGHT", "LUMI", "ILLUMIN", "PIR", "PRESENCE", "DAYLIGHT")) {
            families.add("LIGHT");
        }
        if (containsAny(normalizedType, normalizedLabel, "SON", "NOISE", "SOUND", "LAEQ", "ACOUST")) {
            families.add("SON");
        }
        if (containsAny(normalizedType, normalizedLabel, "TEMP", "TEMPERATURE", "CLIMATE")) {
            families.add("TEMP");
        }
        if (containsAny(normalizedType, normalizedLabel, "HUMID", "HYGRO")) {
            families.add("HUMIDITY");
        }

        return families;
    }

    public static String canonicalTypeName(DeviceType deviceType) {
        return normalizeToken(deviceType != null ? deviceType.getTypeName() : null);
    }

    private static DeviceType cloneAsDashboardType(DeviceType source, String typeName, String label) {
        DeviceType deviceType = new DeviceType();
        deviceType.setIdDeviceType(source.getIdDeviceType());
        deviceType.setTypeName(typeName);
        deviceType.setLabel(label);
        return deviceType;
    }

    private static boolean containsAny(String normalizedType, String normalizedLabel, String... candidates) {
        for (String candidate : candidates) {
            String normalizedCandidate = normalizeText(candidate);
            if (normalizedType.contains(normalizedCandidate) || normalizedLabel.contains(normalizedCandidate)) {
                return true;
            }
        }
        return false;
    }

    private static String fallbackLabel(DeviceType deviceType) {
        if (deviceType == null) {
            return "";
        }
        if (deviceType.getLabel() != null && !deviceType.getLabel().isBlank()) {
            return deviceType.getLabel();
        }
        return canonicalTypeName(deviceType);
    }

    private static String normalizeToken(String value) {
        String normalized = normalizeText(value);
        return switch (normalized) {
            case "NOISE" -> "SON";
            case "ENERGY" -> "CONSO";
            case "OCCUP" -> "DESK";
            default -> normalized.replace(' ', '_');
        };
    }

    private static String normalizeText(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .trim()
                .toUpperCase(Locale.ROOT)
                .replace('/', ' ')
                .replace('-', ' ')
                .replaceAll("\\s+", " ");

        return Objects.requireNonNullElse(normalized, "");
    }
}
