package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.repository.SensorDataDao;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequiredArgsConstructor
public class EnergyChannelController {

    private final SensorDataDao sensorDataDao;
    private final JdbcTemplate jdbcTemplate;
    private static final ZoneId PARIS_ZONE = ZoneId.of("Europe/Paris");

    @GetMapping("/api/dashboard/energy-channels")
    @ResponseBody
    public EnergyChannelResponse getEnergyChannels(
            @RequestParam String sensorId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") java.util.Date customStartDate,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") java.util.Date customEndDate
    ) {
        log.info("Fetching DAILY energy totals for sensor={}, start={}, end={}", sensorId, customStartDate, customEndDate);

        // Convert dates to LocalDate in Paris timezone
        LocalDate startLocalDate = customStartDate.toInstant().atZone(PARIS_ZONE).toLocalDate();
        LocalDate endLocalDate = customEndDate.toInstant().atZone(PARIS_ZONE).toLocalDate();

        // Define all 12 energy channels
        List<PayloadValueType> channels = Arrays.asList(
                PayloadValueType.ENERGY_CHANNEL_0, PayloadValueType.ENERGY_CHANNEL_1, PayloadValueType.ENERGY_CHANNEL_2,
                PayloadValueType.ENERGY_CHANNEL_3, PayloadValueType.ENERGY_CHANNEL_4, PayloadValueType.ENERGY_CHANNEL_5,
                PayloadValueType.ENERGY_CHANNEL_6, PayloadValueType.ENERGY_CHANNEL_7, PayloadValueType.ENERGY_CHANNEL_8,
                PayloadValueType.ENERGY_CHANNEL_9, PayloadValueType.ENERGY_CHANNEL_10, PayloadValueType.ENERGY_CHANNEL_11
        );

        // Calculate daily totals for each day in the range
        List<DailyEnergyData> dailyData = new ArrayList<>();

        LocalDate currentDate = startLocalDate;
        while (!currentDate.isAfter(endLocalDate)) {
            DailyEnergyData dayData = new DailyEnergyData(currentDate.toString());

            // For each channel, calculate daily consumption (end - start)
            for (PayloadValueType channel : channels) {
                int channelNum = getChannelNumber(channel);
                Double dailyConsumption = calculateDailyConsumption(sensorId, channel, currentDate);
                
                if (dailyConsumption != null) {
                    // Convert Wh to kWh
                    dayData.setChannelValue(channelNum, dailyConsumption / 1000.0);
                }
            }

            dailyData.add(dayData);
            currentDate = currentDate.plusDays(1);
        }

        return new EnergyChannelResponse(dailyData);
    }

    /**
     * Calculate daily energy consumption for a channel (last value - first value of the day)
     * Handles incremental data with possible negative values
     */
    private Double calculateDailyConsumption(String sensorId, PayloadValueType channel, LocalDate day) {
        try {
            LocalDateTime dayStart = day.atStartOfDay();
            LocalDateTime dayEnd = day.plusDays(1).atStartOfDay().minusSeconds(1);

            // Convert Paris time to UTC for database query
            ZonedDateTime startUtc = dayStart.atZone(PARIS_ZONE).withZoneSameInstant(ZoneOffset.UTC);
            ZonedDateTime endUtc = dayEnd.atZone(PARIS_ZONE).withZoneSameInstant(ZoneOffset.UTC);

            // Get first value of the day (must have end constraint to limit to this specific day!)
            String queryFirst = "SELECT value FROM sensor_data " +
                    "WHERE id_sensor = ? AND value_type = ? " +
                    "AND received_at >= ? AND received_at <= ? " +
                    "ORDER BY received_at ASC LIMIT 1";

            // Get last value of the day
            String queryLast = "SELECT value FROM sensor_data " +
                    "WHERE id_sensor = ? AND value_type = ? " +
                    "AND received_at >= ? AND received_at <= ? " +
                    "ORDER BY received_at DESC LIMIT 1";

            List<Double> firstResult = jdbcTemplate.query(
                    queryFirst,
                    (rs, rowNum) -> {
                        String val = rs.getString("value");
                        return val != null ? Double.parseDouble(val) : null;
                    },
                    sensorId, channel.name(), startUtc.toLocalDateTime(), endUtc.toLocalDateTime()
            );

            List<Double> lastResult = jdbcTemplate.query(
                    queryLast,
                    (rs, rowNum) -> {
                        String val = rs.getString("value");
                        return val != null ? Double.parseDouble(val) : null;
                    },
                    sensorId, channel.name(), startUtc.toLocalDateTime(), endUtc.toLocalDateTime()
            );

            if (!firstResult.isEmpty() && !lastResult.isEmpty()) {
                Double firstValue = firstResult.get(0);
                Double lastValue = lastResult.get(0);

                if (firstValue != null && lastValue != null) {
                    // Calculate difference (handles negative values)
                    double consumption = lastValue - firstValue;
                    
                    // DEBUG: Log CH0 and CH1 in detail to find why they're 70x too small
                    if (channel.name().equals("ENERGY_CHANNEL_0") || channel.name().equals("ENERGY_CHANNEL_1")) {
                        log.warn("🔍 DEBUG {} on {}: FIRST={} Wh, LAST={} Wh, CONSUMPTION={} Wh ({} kWh)", 
                                channel.name(), day, firstValue, lastValue, consumption, consumption / 1000.0);
                    } else {
                        log.debug("Channel {} on {}: {} - {} = {} Wh", 
                                channel.name(), day, lastValue, firstValue, consumption);
                    }
                    return consumption;
                }
            }

            return null;
        } catch (Exception e) {
            log.error("Error calculating daily consumption for channel {} on {}: {}", 
                    channel.name(), day, e.getMessage());
            return null;
        }
    }

    private int getChannelNumber(PayloadValueType channel) {
        String name = channel.name();
        return Integer.parseInt(name.replace("ENERGY_CHANNEL_", ""));
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class EnergyChannelResponse {
        private List<DailyEnergyData> dataPoints;
    }

    @lombok.Data
    public static class DailyEnergyData {
        private String date; // Format: "2026-01-20"
        private Map<Integer, Double> channels = new HashMap<>(); // Channel number -> kWh

        public DailyEnergyData(String date) {
            this.date = date;
        }

        public void setChannelValue(int channelNum, Double kwhValue) {
            channels.put(channelNum, kwhValue);
        }
    }
}
