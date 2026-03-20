package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.DeviceType;
import com.amaris.sensorprocessor.entity.LorawanSensorData;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.repository.SensorDataDao;

import org.springframework.http.codec.ServerSentEvent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SensorService {

    private final SensorDao sensorDao;
    private final SensorDataDao sensorDataDao;
    private final SensorLorawanService lorawanService;
    private final WebClient webClient;
    private final WebClient webClientSse;
    private final DeviceTypeService deviceTypeService;

    @Value("${api.base.url}")
    private String baseUrl;

    /* ===================== MONITORING (SSE) ===================== */
    public Flux<ServerSentEvent<String>> getMonitoringData(String appId, String deviceId) {
        List<String> deviceIds = List.of(deviceId);
        ObjectMapper om = new ObjectMapper();

        return webClientSse.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/monitoring/app/{appId}/stream")
                        .build(appId))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(deviceIds)
                .retrieve()
                .bodyToFlux(new org.springframework.core.ParameterizedTypeReference<ServerSentEvent<String>>() {})
                .filter(sse -> sse.data() != null && !sse.data().isBlank())
                .filter(sse -> {
                    try {
                        JsonNode root = om.readTree(sse.data());
                        if (root.has("raw") && root.get("raw").isObject()) root = root.get("raw");
                        JsonNode result = root.has("result") ? root.get("result") : root;
                        JsonNode dp = result.path("uplink_message").path("decoded_payload");
                        // snapshot sans decoded_payload → on laisse passer quand même
                        return !dp.isMissingNode() && !dp.isNull()
                                || "snapshot".equals(sse.event());
                    } catch (Exception e) { return false; }
                })
                .doOnError(err -> log.error("[Sensor] SSE error appId={}, deviceId={}", appId, deviceId, err));
    }

    public Flux<String> getGatewayDevices(String appId, Instant after) {
        return webClientSse.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/api/monitoring/app/{appId}/uplinks");
                    if (after != null) uriBuilder.queryParam("after", after.toString());
                    uriBuilder.queryParam("limit", 200);
                    uriBuilder.queryParam("order", "-received_at");
                    return uriBuilder.build(appId);
                })
                .accept(MediaType.valueOf("application/x-ndjson"))
                .retrieve()
                .bodyToFlux(String.class)
                .flatMap(chunk -> {
                    if (chunk == null || chunk.isBlank()) return Flux.empty();
                    List<String> parts = new ArrayList<>(Arrays.asList(chunk.split("\\R")));
                    List<String> expanded = new ArrayList<>();
                    for (String p : parts) {
                        if (p != null && p.contains("}{")) {
                            expanded.addAll(Arrays.asList(p.split("(?<=\\})(?=\\{)")));
                        } else {
                            expanded.add(p);
                        }
                    }
                    return Flux.fromIterable(expanded).map(String::trim).filter(s -> !s.isBlank());
                });
    }

    public Flux<String> getMonitoringMany(String appId, List<String> deviceIds) {
        return webClientSse.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/monitoring/app/{appId}/stream")
                        .build(appId))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(deviceIds == null ? List.of() : deviceIds)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnError(err -> log.error("[Sensor] SSE multi error appId={}: {}", appId, err.getMessage(), err));
    }

    /* ===================== READ ===================== */

    public List<Sensor> findAll() {
        return sensorDao.findAllSensors();
    }

    public Optional<Sensor> findByIdSensor(String idSensor) {
        return sensorDao.findByIdOfSensor(idSensor);
    }

    /**
     * Get sensor IDs by device type and building
     * @param deviceType Device type (CO2, TEMPEX, HUMIDITY, NOISE, etc.)
     * @param building Building name (empty string for all buildings)
     * @return List of sensor IDs
     */
    public List<String> getSensorIdsByTypeAndBuilding(String deviceType, Integer building) {
        List<Sensor> sensors;
        if (building == null) {
            sensors = sensorDao.findAllByDeviceType(deviceType);
        } else {
            sensors = sensorDao.findAllByDeviceTypeAndBuilding(deviceType, building);
        }
        return sensors.stream()
                .map(Sensor::getIdSensor)
                .collect(java.util.stream.Collectors.toList());
    }

    public List<Sensor> findAllByBuildingId(String buildingId) {
        return sensorDao.findAllByBuildingId(Integer.parseInt(buildingId));
    }

    public List<Sensor> findAllByBuildingAndFloor(String buildingId, Integer floorNumber) {
        return sensorDao.findAllByBuildingAndFloor(buildingId, floorNumber);
    }


    public Sensor getOrThrow(String idSensor) {
        return findByIdSensor(idSensor)
                .orElseThrow(() -> new IllegalArgumentException("Sensor not found: " + idSensor));
    }

    public HashMap<PayloadValueType, SensorData> getSensorData(String idSensor) {
        return sensorDataDao.findLatestDataBySensor(idSensor);
    }

    public LinkedHashMap<LocalDateTime, String> findSensorDataByPeriodAndType(String idSensor, Date startDate,
                                                                              Date endDate, PayloadValueType valueType, Optional<Integer> limit) {
        var datas = sensorDataDao.findSensorDataByPeriodAndType(idSensor, startDate, endDate, valueType, limit);
        LinkedHashMap<LocalDateTime, String> timeToStringValueMap = new LinkedHashMap<>();
        String lastValue = null;

        for (SensorData data : datas) {
            String currentValue = data.getValueAsString();
            if (!Objects.equals(currentValue, lastValue)) {
                timeToStringValueMap.put(data.getReceivedAt(), currentValue);
                lastValue = currentValue;
            }
        }
        return timeToStringValueMap;
    }

    public Map<PayloadValueType, LinkedHashMap<LocalDateTime, String>> findSensorDataByPeriod(String idSensor,
                                                                                              Date startDate, Date endDate) {
        List<SensorData> allSensorDatas = sensorDataDao.findSensorDataByPeriod(idSensor, startDate, endDate);
        Map<PayloadValueType, LinkedHashMap<LocalDateTime, String>> groupedData = new LinkedHashMap<>();
        for (SensorData data : allSensorDatas) {
            groupedData.computeIfAbsent(data.getValueType(), k -> new LinkedHashMap<>())
                    .put(data.getReceivedAt(), data.getValueAsString());
        }
        return groupedData;
    }

    public Map<Date, Double> getConsumptionByChannels(String idSensor, Date startDate, Date endDate,
                                                      List<String> channels) {
        Set<PayloadValueType> energyChannels = channels.stream()
                .map(ch -> PayloadValueType.valueOf("ENERGY_CHANNEL_" + ch))
                .collect(Collectors.toSet());

        Instant adjustedStartInstant = startDate.toInstant().minus(1, ChronoUnit.HOURS);
        Date adjustedStartDate = Date.from(adjustedStartInstant);
        List<SensorData> allSensorData = sensorDataDao.findSensorDataByPeriodAndTypes2(idSensor, adjustedStartDate,
                endDate, energyChannels);

        Instant startInstant = adjustedStartInstant.truncatedTo(ChronoUnit.HOURS);
        Instant endInstant = endDate.toInstant();

        Map<Instant, Map<PayloadValueType, Double>> hourlyChannelValues = new LinkedHashMap<>();
        Map<PayloadValueType, Double> lastKnownValues = new HashMap<>();

        for (PayloadValueType channel : energyChannels) {
            Optional<SensorData> lastData = sensorDataDao.findLastValueBefore(idSensor, channel, startInstant);
            lastKnownValues.put(channel, lastData.map(SensorData::getValueAsDouble).orElse(0.0));
        }

        Instant currentHour = startInstant;
        int dataIndex = 0;

        while (!currentHour.isAfter(endInstant)) {
            while (dataIndex < allSensorData.size()) {
                SensorData dataPoint = allSensorData.get(dataIndex);
                Instant dataTimestamp = dataPoint.getReceivedAt().atZone(java.time.ZoneOffset.UTC).toInstant();
                if (dataTimestamp.isAfter(currentHour)) break;
                Double value = dataPoint.getValueAsDouble();
                if (value != null) lastKnownValues.put(dataPoint.getValueType(), value);
                dataIndex++;
            }
            hourlyChannelValues.put(currentHour, new HashMap<>(lastKnownValues));
            currentHour = currentHour.plus(1, ChronoUnit.HOURS);
        }

        Map<Date, Double> finalHourlyConsumption = new LinkedHashMap<>();
        List<Instant> hours = new ArrayList<>(hourlyChannelValues.keySet());
        hours.sort(Instant::compareTo);

        for (int i = 1; i < hours.size(); i++) {
            Instant currentHourKey = hours.get(i);
            Instant previousHourKey = hours.get(i - 1);

            Map<PayloadValueType, Double> currentValues = hourlyChannelValues.get(currentHourKey);
            Map<PayloadValueType, Double> previousValues = hourlyChannelValues.get(previousHourKey);

            double totalConsumption = 0.0;
            for (PayloadValueType channel : energyChannels) {
                double currentValue = currentValues.getOrDefault(channel, 0.0);
                double previousValue = previousValues.getOrDefault(channel, 0.0);
                double channelConsumption = currentValue < previousValue ? currentValue : currentValue - previousValue;
                totalConsumption += channelConsumption;
            }

            finalHourlyConsumption.put(Date.from(currentHourKey), totalConsumption);
        }

        return finalHourlyConsumption;
    }

    public Double getCurrentConsumption(String idSensor, List<String> channels, int minutes) {
        Instant now = Instant.now();
        Instant timeAgo = now.minus(Math.max(1, minutes), ChronoUnit.MINUTES);

        if (channels == null || channels.isEmpty()) return 0.0;

        Set<PayloadValueType> energyChannels = channels.stream()
                .map(ch -> PayloadValueType.valueOf("ENERGY_CHANNEL_" + ch))
                .collect(Collectors.toSet());

        if (energyChannels.isEmpty()) return 0.0;

        List<SensorData> recentData = sensorDataDao.findSensorDataByPeriodAndTypes2(idSensor, Date.from(timeAgo),
                Date.from(now), energyChannels);

        Map<PayloadValueType, List<SensorData>> dataByChannel = recentData.stream()
                .collect(Collectors.groupingBy(SensorData::getValueType));

        double totalConsumption = 0;
        for (PayloadValueType channel : energyChannels) {
            List<SensorData> channelData = dataByChannel.get(channel);
            if (channelData != null && channelData.size() > 1) {
                channelData.sort(java.util.Comparator.comparing(SensorData::getReceivedAt));
                double oldestValue = channelData.get(0).getValueAsDouble();
                double latestValue = channelData.get(channelData.size() - 1).getValueAsDouble();
                double delta = latestValue - oldestValue;
                if (delta < 0) delta = latestValue;
                totalConsumption += delta;
            }
        }

        return totalConsumption > 0 ? totalConsumption : null;
    }

    /* ===================== CREATE ===================== */

    @Transactional
    public Sensor create(Sensor toCreate) {
        if (toCreate.getIdSensor() == null || toCreate.getIdSensor().isBlank())
            throw new IllegalArgumentException("idSensor is required");

        if (sensorDao.findByIdOfSensor(toCreate.getIdSensor()).isPresent())
            throw new IllegalStateException("idSensor already exists: " + toCreate.getIdSensor());

        if (toCreate.getCommissioningDate() == null || toCreate.getCommissioningDate().isBlank())
            toCreate.setCommissioningDate(Instant.now().toString());

        if (toCreate.getStatus() == null) toCreate.setStatus(Boolean.TRUE);

        int rows = sensorDao.insertSensor(toCreate);
        if (rows != 1) throw new IllegalStateException("DB insert failed for sensor " + toCreate.getIdSensor());
        log.info("[Sensor] DB created idSensor={}", toCreate.getIdSensor());

        try {
            if (toCreate.getIdGateway() == null || toCreate.getIdGateway().isBlank()) {
                log.warn("[Sensor] No idGateway provided for {} → skipping TTN create", toCreate.getIdSensor());
            } else {
                LorawanSensorData lorawan = lorawanService.toLorawanCreate(toCreate);
                lorawanService.createDevice(toCreate.getIdGateway(), lorawan);
                log.info("[Sensor] TTN created device {} (app={}-app)", toCreate.getIdSensor(), toCreate.getIdGateway());
            }
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 409) {
                log.warn("[Sensor] TTN device {} already exists (409). Continue.", toCreate.getIdSensor());
            } else {
                log.error("[Sensor] TTN create failed for {}: {}", toCreate.getIdSensor(), e.getMessage(), e);
            }
        } catch (Exception e) {
            log.error("[Sensor] TTN create unexpected error for {}: {}", toCreate.getIdSensor(), e.getMessage(), e);
        }

        return sensorDao.findByIdOfSensor(toCreate.getIdSensor()).orElse(toCreate);
    }

    /* ===================== UPDATE ===================== */

    @Transactional
    public Sensor update(String idSensor, Sensor patch) {
        Sensor existing = getOrThrow(idSensor);

        if (patch.getIdSensor() != null && !patch.getIdSensor().isBlank()
                && !patch.getIdSensor().equals(existing.getIdSensor())) {
            throw new IllegalArgumentException("Renaming idSensor is not supported by current DAO");
        }

        boolean ttnUpdateNeeded = false;
        if (patch.getDevEui() != null && !patch.getDevEui().equals(existing.getDevEui())) {
            existing.setDevEui(patch.getDevEui());
            ttnUpdateNeeded = true;
        }
        if (patch.getJoinEui() != null && !patch.getJoinEui().equals(existing.getJoinEui())) {
            existing.setJoinEui(patch.getJoinEui());
            ttnUpdateNeeded = true;
        }
        if (patch.getAppKey() != null && !patch.getAppKey().equals(existing.getAppKey())) {
            existing.setAppKey(patch.getAppKey());
            ttnUpdateNeeded = true;
        }

        // ✅ idDeviceType à la place de deviceType
        if (patch.getIdDeviceType() != null) existing.setIdDeviceType(patch.getIdDeviceType());
        if (patch.getCommissioningDate() != null) existing.setCommissioningDate(patch.getCommissioningDate());
        if (patch.getFloor() != null)             existing.setFloor(patch.getFloor());
        if (patch.getLocation() != null)          existing.setLocation(patch.getLocation());
        if (patch.getBuildingId() != null)      existing.setBuildingId(patch.getBuildingId());

        int rows = sensorDao.updateSensor(existing);
        if (rows != 1) throw new IllegalStateException("DB update failed for sensor " + idSensor);
        log.info("[Sensor] DB updated idSensor={}", idSensor);

        if (ttnUpdateNeeded) {
            try {
                if (existing.getIdGateway() == null || existing.getIdGateway().isBlank()) {
                    log.warn("[Sensor] No idGateway for {} → skipping TTN update", idSensor);
                } else {
                    LorawanSensorData lorawan = lorawanService.toLorawanCreate(existing);
                    lorawanService.updateDevice(existing.getIdGateway(), idSensor, lorawan);
                    log.info("[Sensor] TTN updated device {} (app={}-app)", idSensor, existing.getIdGateway());
                }
            } catch (WebClientResponseException e) {
                log.error("[Sensor] TTN update failed for {}: {}", idSensor, e.getMessage(), e);
            } catch (Exception e) {
                log.error("[Sensor] TTN update unexpected error for {}: {}", idSensor, e.getMessage(), e);
            }
        }

        return existing;
    }

    /* ===================== DELETE ===================== */

    @Transactional
    public void delete(String idSensor) {
        Sensor existing = getOrThrow(idSensor);

        try {
            lorawanService.deleteDevice(existing.getIdGateway(), idSensor);
            log.info("[Sensor] TTN deleted device {} (app={}-app)", idSensor, existing.getIdGateway());
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                log.warn("[Sensor] TTN device {} not found in app {}-app (already deleted?)",
                        idSensor, existing.getIdGateway());
            } else {
                log.error("[Sensor] TTN delete failed for {} (app={}-app): {}",
                        idSensor, existing.getIdGateway(), e.getMessage());
            }
        } catch (Exception e) {
            log.error("[Sensor] TTN delete unexpected error for {}: {}", idSensor, e.getMessage(), e);
        }

        int rows = sensorDao.deleteByIdOfSensor(idSensor);
        if (rows == 0) throw new IllegalArgumentException("Sensor not found: " + idSensor);

        log.info("[Sensor] DB deleted idSensor={}", idSensor);
    }

    /* ===================== SET STATUS ===================== */

    @Transactional
    public Sensor setStatus(String idSensor, boolean active) {
        Sensor existing = getOrThrow(idSensor);
        existing.setStatus(active);

        int rows = sensorDao.updateSensor(existing);
        if (rows != 1) throw new IllegalStateException("DB update status failed for " + idSensor);

        return existing;
    }
}
