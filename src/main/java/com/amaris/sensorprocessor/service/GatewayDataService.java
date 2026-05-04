package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.GatewayData;
import com.amaris.sensorprocessor.entity.GatewayValueType;
import com.amaris.sensorprocessor.entity.MonitoringGatewayData;
import com.amaris.sensorprocessor.repository.GatewayDataDao;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GatewayDataService {

    private final GatewayDataDao gatewayDataDao;

    public void storeMonitoringData(String gatewayId, MonitoringGatewayData data) {
        if (gatewayId == null || data == null) {
            return;
        }

        LocalDateTime receivedAt = parseTimestamp(data.getTimestamp());
        List<GatewayData> rows = toGatewayDataRows(gatewayId, receivedAt, data);
        int inserted = 0;

        for (GatewayData row : rows) {
            try {
                inserted += gatewayDataDao.insertGatewayData(row);
            } catch (DuplicateKeyException ignored) {
                log.debug("[GatewayData] Duplicate ignored for gateway={}, receivedAt={}, type={}",
                        row.getIdGateway(), row.getReceivedAt(), row.getValueType());
            } catch (Exception e) {
                log.error("[GatewayData] Error inserting gateway data gateway={}, type={}: {}",
                        row.getIdGateway(), row.getValueType(), e.getMessage(), e);
            }
        }

        if (inserted > 0) {
            log.debug("[GatewayData] Inserted {} metrics for gateway={} at {}", inserted, gatewayId, receivedAt);
        }
    }

    public Map<GatewayValueType, GatewayData> findLatestDataByGateway(String gatewayId) {
        Map<GatewayValueType, GatewayData> latestData = gatewayDataDao.findLatestDataByGateway(gatewayId);
        Map<GatewayValueType, GatewayData> result = new LinkedHashMap<>();
        for (Map.Entry<GatewayValueType, GatewayData> entry : latestData.entrySet()) {
            if (GatewayValueType.HISTORY_TYPES.contains(entry.getKey())) {
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return result;
    }

    public LinkedHashMap<LocalDateTime, String> findGatewayDataByPeriodAndType(
            String gatewayId,
            Date startDate,
            Date endDate,
            GatewayValueType valueType,
            Optional<Integer> limit
    ) {
        if (!GatewayValueType.HISTORY_TYPES.contains(valueType)) {
            return new LinkedHashMap<>();
        }

        List<GatewayData> rows = gatewayDataDao.findGatewayDataByPeriodAndType(gatewayId, startDate, endDate, valueType, limit);
        LinkedHashMap<LocalDateTime, String> result = new LinkedHashMap<>();
        for (GatewayData row : rows) {
            result.put(row.getReceivedAt(), row.getAsString());
        }
        return result;
    }

    public Map<GatewayValueType, LinkedHashMap<LocalDateTime, String>> findGatewayDataByPeriod(
            String gatewayId,
            Date startDate,
            Date endDate
    ) {
        List<GatewayData> rows = gatewayDataDao.findGatewayDataByPeriod(gatewayId, startDate, endDate);
        Map<GatewayValueType, LinkedHashMap<LocalDateTime, String>> result = new LinkedHashMap<>();
        for (GatewayData row : rows) {
            if (!GatewayValueType.HISTORY_TYPES.contains(row.getValueType())) {
                continue;
            }
            result.computeIfAbsent(row.getValueType(), key -> new LinkedHashMap<>())
                    .put(row.getReceivedAt(), row.getAsString());
        }
        return result;
    }

    private List<GatewayData> toGatewayDataRows(String gatewayId, LocalDateTime receivedAt, MonitoringGatewayData data) {
        List<GatewayData> rows = new ArrayList<>();

        MonitoringGatewayData.SystemInfo system = data.getSystem();
        if (system != null) {
            add(rows, gatewayId, receivedAt, GatewayValueType.CPU_PERCENT, system.getCpuPercent());
            add(rows, gatewayId, receivedAt, GatewayValueType.CPU_TEMP, system.getCpuTemp());
            add(rows, gatewayId, receivedAt, GatewayValueType.RAM_USED_GB, system.getRamUsedGb());
            add(rows, gatewayId, receivedAt, GatewayValueType.DISK_USAGE_PERCENT, cleanPercent(system.getDiskUsagePercent()));
            add(rows, gatewayId, receivedAt, GatewayValueType.GATEWAY_STATUS, system.getGatewayStatus());
        }

        if (data.getDevices() != null) {
            add(rows, gatewayId, receivedAt, GatewayValueType.DEVICE_COUNT, data.getDevices().size());
        }

        return rows;
    }

    private void add(List<GatewayData> rows, String gatewayId, LocalDateTime receivedAt, GatewayValueType valueType, Object value) {
        if (value == null) {
            return;
        }
        rows.add(new GatewayData(gatewayId, receivedAt, value.toString(), valueType));
    }

    private String cleanPercent(String value) {
        return value == null ? null : value.replace("%", "").trim();
    }

    private LocalDateTime parseTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return LocalDateTime.now();
        }

        try {
            return LocalDateTime.ofInstant(Instant.parse(timestamp), ZoneId.systemDefault());
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(timestamp);
            } catch (DateTimeParseException e) {
                log.warn("[GatewayData] Invalid timestamp '{}', using current time", timestamp);
                return LocalDateTime.now();
            }
        }
    }
}
